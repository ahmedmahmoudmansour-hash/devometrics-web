import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { KNOWLEDGE_HUB_BUCKET } from "@/lib/knowledgeHub/constants";
import { guessScormMimeType } from "@/lib/knowledgeHub/scorm/constants";

// Serves an unpacked SCORM package's files SAME-ORIGIN with the app. This
// is not a cosmetic choice: SCORM 1.2's API-discovery algorithm has the
// content window walk up window.parent (then window.parent.parent, ...)
// looking for a property named "API" — and that property access is
// something the browser's Same-Origin Policy blocks outright for a
// cross-origin frame, regardless of any iframe sandbox attribute. A
// Supabase Storage signed URL lives on a different origin than this app,
// so serving the package straight from one (as a first draft of this
// route did) would silently break every real SCORM package's ability to
// ever find window.parent.API — the runtime adapter would just never be
// called. Proxying every file through this same-origin route is what
// makes the whole runtime bridge in
// components/dashboard/KnowledgeHubScormRuntime.tsx actually reachable.
//
// Auth mirrors getSignedKnowledgeHubUrl in lib/knowledgeHub/actions.ts:
// specifically assigned to this employee, OR an org admin previewing it.

// Text-ish asset types get an explicit charset for this route's response
// headers (the shared table in lib/knowledgeHub/scorm/constants.ts doesn't
// carry one — it's also used for Storage upload contentType, where a
// charset suffix isn't meaningful).
const TEXT_MIME_TYPES = new Set(["text/html", "application/javascript", "text/css", "application/json", "application/xml"]);

function guessMimeType(fileName: string): string {
  const mime = guessScormMimeType(fileName);
  return TEXT_MIME_TYPES.has(mime) ? `${mime}; charset=utf-8` : mime;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ contentId: string; path: string[] }> }) {
  const { contentId, path } = await params;

  // Defense in depth against path traversal in the requested asset path —
  // storage_path is server-controlled, but these segments come straight
  // from the URL. Reject anything that isn't a plain relative segment.
  if (path.length === 0 || path.some((segment) => segment === ".." || segment === "." || segment.includes("\\") || segment === "")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  const relativePath = path.join("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Neither query depends on the other's result (both only need contentId /
  // user.id, already known) — run them together instead of paying two
  // sequential round trips on every single asset request this SCORM
  // package's iframe makes.
  const [{ data: content }, { data: assignment }] = await Promise.all([
    supabase
      .from("knowledge_hub_content")
      .select("organization_id, storage_path, content_type")
      .eq("id", contentId)
      .maybeSingle<{ organization_id: string; storage_path: string; content_type: string }>(),
    supabase
      .from("knowledge_hub_assignments")
      .select("id")
      .eq("content_id", contentId)
      .eq("employee_user_id", user.id)
      .maybeSingle<{ id: string }>(),
  ]);
  if (!content || content.content_type !== "scorm") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let authorized = !!assignment;
  if (!authorized) {
    const company = await buildCompanyData();
    authorized = company.isOrgAdmin && company.organizationId === content.organization_id;
  }
  if (!authorized) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { data: fileBlob, error } = await supabase.storage.from(KNOWLEDGE_HUB_BUCKET).download(`${content.storage_path}/${relativePath}`);
  if (error || !fileBlob) return NextResponse.json({ error: "File not found" }, { status: 404 });

  // Stream the blob straight through instead of buffering the whole file
  // into memory first — matters for embedded audio/video assets, which this
  // route's own MIME table (mp3/mp4) confirms can show up in a package.
  return new NextResponse(fileBlob.stream(), {
    headers: {
      "Content-Type": guessMimeType(relativePath),
      // Private, short cache — this is gated by an auth check on every
      // request, not a public asset.
      "Cache-Control": "private, max-age=300",
    },
  });
}
