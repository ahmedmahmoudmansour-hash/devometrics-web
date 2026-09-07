"use server";

import yauzl from "yauzl";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { KNOWLEDGE_HUB_BUCKET } from "@/lib/knowledgeHub/constants";
import { insertKnowledgeHubContentRow, autoAssignNewCourseModule } from "@/lib/knowledgeHub/actions";
import { parseScormManifest } from "./manifest";
import {
  SCORM_MAX_UNCOMPRESSED_BYTES,
  SCORM_MAX_FILE_COUNT,
  SCORM_MAX_FILE_BYTES,
  SCORM_MAX_COMPRESSION_RATIO,
  SCORM_PROCESSING_BUDGET_MS,
} from "./constants";

const MIME_BY_EXTENSION: Record<string, string> = {
  html: "text/html",
  htm: "text/html",
  js: "application/javascript",
  css: "text/css",
  json: "application/json",
  xml: "application/xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  woff: "font/woff",
  woff2: "font/woff2",
  mp3: "audio/mpeg",
  mp4: "audio/mp4",
};

function guessMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
}

// Reads every real (non-directory) entry in the zip, enforcing every hard
// limit against the archive's own declared central-directory metadata
// BEFORE that entry's bytes are decompressed — yauzl parses the central
// directory up front (sizes are known without inflating anything), so a
// check against entry.uncompressedSize/compressedSize here genuinely runs
// pre-decompression, not as an after-the-fact cleanup. Path traversal
// (".."/absolute paths/backslashes) is rejected unconditionally by yauzl
// itself during parsing (validateFileName, always-on whenever decodeStrings
// is true) — that surfaces as a thrown error from zipfile.eachEntry()
// below, not as a check this function hand-rolls.
//
// Each file is re-uploaded to Storage IMMEDIATELY after extraction, in this
// same loop, rather than collected into one big in-memory array first. At
// the raised limits (250MB uncompressed, 100MB/file) collecting everything
// before uploading anything would mean peak memory of roughly (raw zip
// buffer) + (every extracted file's buffer simultaneously) — this way peak
// memory is (raw zip buffer) + (one file's buffer at a time), regardless of
// total package size. The tradeoff: a failure partway through can leave
// files 1..N-1 already in Storage when file N fails — cleanupUploaded()
// below exists specifically to undo that on any failure path, so a failed
// ingestion never leaves a partial package behind.
async function extractUploadAndValidateScormPackage(
  zipBuffer: Buffer,
  supabase: SupabaseClient,
  scormPrefix: string
): Promise<{ error: string } | { version: "1.2"; launchPath: string; totalBytes: number }> {
  const startedAt = Date.now();
  const uploadedPaths: string[] = [];

  async function cleanupUploaded() {
    if (uploadedPaths.length === 0) return;
    try {
      await supabase.storage.from(KNOWLEDGE_HUB_BUCKET).remove(uploadedPaths);
    } catch {
      // Best-effort only — a cleanup failure must never mask or block
      // returning the original error below.
    }
  }
  async function fail(message: string): Promise<{ error: string }> {
    await cleanupUploaded();
    return { error: message };
  }

  let zipfile: yauzl.ZipFile;
  try {
    zipfile = await yauzl.fromBufferPromise(zipBuffer, {
      lazyEntries: true,
      decodeStrings: true,
      validateEntrySizes: true,
      strictFileNames: true,
    });
  } catch {
    return { error: "This doesn't look like a valid zip file." };
  }

  let totalUncompressed = 0;
  let totalBytes = 0;
  let fileCount = 0;
  let manifestContent: string | null = null;

  try {
    for await (const entry of zipfile.eachEntry()) {
      if (Date.now() - startedAt > SCORM_PROCESSING_BUDGET_MS) {
        return await fail("This package is too large or complex to process. Try a smaller SCORM package.");
      }

      if (entry.fileName.endsWith("/")) continue; // directory entry — nothing to extract

      // Symlink rejection: externalFileAttributes' upper 16 bits carry the
      // Unix file mode when the archive was made on a Unix host (always 0
      // on Windows-made zips, so this check is simply always false there).
      const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff;
      const isSymlink = (unixMode & 0xf000) === 0xa000;
      if (isSymlink) {
        return await fail(`Package rejected: "${entry.fileName}" is a symlink, which isn't allowed in an uploaded package.`);
      }

      fileCount += 1;
      if (fileCount > SCORM_MAX_FILE_COUNT) {
        return await fail(`Package rejected: more than ${SCORM_MAX_FILE_COUNT} files.`);
      }

      if (entry.uncompressedSize > SCORM_MAX_FILE_BYTES) {
        return await fail(`Package rejected: "${entry.fileName}" is larger than ${SCORM_MAX_FILE_BYTES / (1024 * 1024)}MB uncompressed.`);
      }

      // Zip-bomb heuristic — an implausible declared ratio is rejected
      // before a single byte of this entry is inflated. compressedSize can
      // legitimately be 0 only for an empty (or near-empty) stored entry,
      // in which case uncompressedSize is also ~0 and this check is moot.
      if (entry.compressedSize > 0 && entry.uncompressedSize / entry.compressedSize > SCORM_MAX_COMPRESSION_RATIO) {
        return await fail(`Package rejected: "${entry.fileName}" has an implausible compression ratio.`);
      }

      totalUncompressed += entry.uncompressedSize;
      if (totalUncompressed > SCORM_MAX_UNCOMPRESSED_BYTES) {
        return await fail(`Package rejected: total uncompressed size exceeds ${SCORM_MAX_UNCOMPRESSED_BYTES / (1024 * 1024)}MB.`);
      }

      const stream = await zipfile.openReadStreamPromise(entry);
      const chunks: Buffer[] = [];
      let actualBytes = 0;
      await new Promise<void>((resolve, reject) => {
        stream.on("data", (chunk: Buffer) => {
          actualBytes += chunk.length;
          // Defense in depth against a header that understates its own
          // uncompressedSize: enforce the same per-file cap against bytes
          // actually produced by inflation, not just the declared value.
          if (actualBytes > SCORM_MAX_FILE_BYTES) {
            stream.destroy();
            reject(new Error(`"${entry.fileName}" decompressed larger than its declared size allows.`));
            return;
          }
          chunks.push(chunk);
        });
        stream.on("end", () => resolve());
        stream.on("error", (err) => reject(err instanceof Error ? err : new Error(String(err))));
      });

      const data = Buffer.concat(chunks);
      if (entry.fileName.toLowerCase() === "imsmanifest.xml") {
        manifestContent = data.toString("utf8");
      }

      const { error: uploadError } = await supabase.storage
        .from(KNOWLEDGE_HUB_BUCKET)
        .upload(`${scormPrefix}/${entry.fileName}`, data, { contentType: guessMimeType(entry.fileName), upsert: true });
      if (uploadError) {
        return await fail(`Could not upload "${entry.fileName}" — try uploading the package again.`);
      }
      uploadedPaths.push(`${scormPrefix}/${entry.fileName}`);
      totalBytes += data.length;
    }
  } catch (err) {
    return await fail(err instanceof Error ? err.message : "Could not process this package.");
  }

  if (uploadedPaths.length === 0) return await fail("This package is empty.");
  if (manifestContent === null) {
    return await fail("This package has no imsmanifest.xml at its root — not a valid SCORM package.");
  }

  const manifestInfo = parseScormManifest(manifestContent);
  if ("error" in manifestInfo) return await fail(manifestInfo.error);

  const launchPathUploaded = uploadedPaths.includes(`${scormPrefix}/${manifestInfo.launchPath}`);
  if (!launchPathUploaded) {
    return await fail(`The manifest's launch file ("${manifestInfo.launchPath}") isn't in the package.`);
  }

  return { version: manifestInfo.version, launchPath: manifestInfo.launchPath, totalBytes };
}

// Called after the client has already uploaded the raw zip directly to
// Storage (same split as createKnowledgeHubContent — see
// KnowledgeHubUploadForm.tsx). Unlike a plain document, a SCORM package
// needs real server-side processing before it can become a
// knowledge_hub_content row: validate, unpack, re-upload each file
// individually, parse the manifest for the launch path, THEN insert the
// content row — so unlike createKnowledgeHubContent this can fail well
// after the upload itself succeeded. On failure, every already-unpacked
// file is cleaned up (see extractUploadAndValidateScormPackage) and no
// content row is ever inserted — the orphaned raw zip itself is harmless
// clutter, not a half-created content row someone could stumble into.
export async function validateAndRegisterScormPackage(input: {
  contentId: string;
  title: string;
  description: string;
  rawZipStoragePath: string;
  maxAttempts?: number | null;
  dueDate?: string | null;
  isNewHireContent?: boolean;
  courseId?: string | null;
}): Promise<{ error: string } | { success: true; contentId: string }> {
  const company = await buildCompanyData();
  if (!company.isOrgAdmin || !company.organizationId) return { error: "Not authorized" };

  const title = input.title.trim();
  if (!title) return { error: "Title is required" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const orgId = company.organizationId;

  const { data: zipBlob, error: downloadError } = await supabase.storage.from(KNOWLEDGE_HUB_BUCKET).download(input.rawZipStoragePath);
  if (downloadError || !zipBlob) return { error: "Could not read the uploaded package — try uploading again." };

  // Re-upload path convention: {organization_id}/{content_id}/scorm/{relative_path}.
  // Playback afterward is then just plain static files served through the
  // same-origin scorm proxy route (app/api/knowledge-hub/scorm/.../route.ts),
  // no runtime unzip-on-request infrastructure needed.
  const scormPrefix = `${orgId}/${input.contentId}/scorm`;
  const result = await extractUploadAndValidateScormPackage(Buffer.from(await zipBlob.arrayBuffer()), supabase, scormPrefix);
  if ("error" in result) return { error: result.error };

  const courseId = input.courseId || null;
  const insertResult = await insertKnowledgeHubContentRow(
    supabase,
    courseId,
    (coursePosition) => ({
      id: input.contentId,
      organization_id: orgId,
      title,
      description: input.description.trim() || null,
      storage_path: scormPrefix,
      file_name: result.launchPath,
      file_size_bytes: Math.max(1, result.totalBytes),
      mime_type: "application/zip",
      completion_type: "scorm",
      passing_score_percent: 80, // unused for scorm — the package's own pass/fail (lesson_status) governs completion
      max_attempts: null, // SCORM retakes aren't attempt-limited the way native exams are — the package itself controls resume/retry
      due_date: input.dueDate || null,
      is_new_hire_content: input.isNewHireContent ?? false,
      created_by: user.id,
      content_type: "scorm",
      scorm_version: result.version,
      scorm_launch_path: result.launchPath,
      course_id: courseId,
      course_position: coursePosition,
    }),
    "Package processed, but could not save it — the database may need migration 0149 run first."
  );
  if ("error" in insertResult) {
    return insertResult;
  }

  if (courseId) await autoAssignNewCourseModule(courseId, input.contentId);

  revalidatePath("/dashboard/company/knowledge-hub");
  return { success: true, contentId: input.contentId };
}
