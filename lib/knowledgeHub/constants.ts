// Split out from actions.ts: a "use server" file may only export async
// functions — Next.js's server-actions compiler rejects plain constant
// exports from such a module (it silently produces "the module has no
// exports at all" at build time), so these live here instead.
export const KNOWLEDGE_HUB_BUCKET = "knowledge-hub-docs";

// Per-content-type ceilings — replaces the old single flat 50MB constant.
// Every one of these is enforced twice: client-side at file selection
// (KnowledgeHubUploadForm's handleFileChange, before any upload starts) and
// again server-side in createKnowledgeHubContent (a client can't be trusted
// to have reported its own file size honestly). Both call
// getKnowledgeHubMaxBytes below so the two checks can never drift apart.
//
// TEMPORARILY held at 50MB across every tier (2026-09-02, Ahmed's call):
// the org's Supabase project is on the Free plan, which hard-caps every
// upload at 50MB at the infrastructure level — no bucket config or Dashboard
// setting can raise it, confirmed live (a 60MB upload was rejected with
// Supabase's own "exceeded the maximum allowed size" error even after the
// bucket's file_size_limit and the Dashboard's "Max file size" field were
// both already raised past 50MB). Rather than let the UI advertise a ceiling
// Supabase won't actually honor, every tier below stays at 50MB until the
// project upgrades to Pro. The intended real values (documents 50MB stays
// as-is, presentations 100MB, SCORM 200MB, video 500MB) are commented next
// to each — flip these back the moment the Pro upgrade lands; nothing else
// in this feature (courses, resumable uploads, the bucket's own 500MB
// file_size_limit from migration 0151) needs to change to support it.
export const KNOWLEDGE_HUB_MAX_BYTES_DOCUMENT = 50 * 1024 * 1024; // pdf, word, excel
export const KNOWLEDGE_HUB_MAX_BYTES_PRESENTATION = 50 * 1024 * 1024; // ppt, pptx — real target: 100MB
export const KNOWLEDGE_HUB_MAX_BYTES_VIDEO = 50 * 1024 * 1024; // mp4, webm, mov — real target: 500MB
// Raw SCORM zip, pre-unpack — real target: 200MB (deliberately NOT matching
// video even after the Pro upgrade: SCORM packages are unzipped
// synchronously in one request — no async job runner exists in this
// codebase, see scorm/constants.ts — so this stays modest even at full
// scale; a "learning journey" needing more than this groups multiple SCORM/
// video/document modules into one course instead of one giant SCORM file.
export const KNOWLEDGE_HUB_MAX_BYTES_SCORM = 50 * 1024 * 1024;

const PRESENTATION_MIME_TYPES = [
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

export const KNOWLEDGE_HUB_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ...PRESENTATION_MIME_TYPES,
  // Recorded walkthroughs / training clips — capped at
  // KNOWLEDGE_HUB_MAX_BYTES_VIDEO via getKnowledgeHubMaxBytes below.
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

// SCORM packages are uploaded as a zip and unpacked server-side (see
// lib/knowledgeHub/scorm/ingest.ts) — kept separate from the document/video
// list above since a zip is never itself the thing shown in the file
// picker's "accept" attribute for regular content uploads.
export const KNOWLEDGE_HUB_SCORM_ZIP_MIME_TYPES = [
  "application/zip",
  "application/x-zip-compressed", // what some Windows-originated zips report instead
] as const;

// The single place that decides "how big can this upload be" — both
// KnowledgeHubUploadForm (client, at file selection) and
// createKnowledgeHubContent (server, re-checking what the client claims)
// call this instead of each hardcoding their own tier logic.
export function getKnowledgeHubMaxBytes(mimeType: string, kind: "document" | "scorm"): number {
  if (kind === "scorm") return KNOWLEDGE_HUB_MAX_BYTES_SCORM;
  if ((PRESENTATION_MIME_TYPES as readonly string[]).includes(mimeType)) return KNOWLEDGE_HUB_MAX_BYTES_PRESENTATION;
  if (mimeType.startsWith("video/")) return KNOWLEDGE_HUB_MAX_BYTES_VIDEO;
  return KNOWLEDGE_HUB_MAX_BYTES_DOCUMENT;
}
