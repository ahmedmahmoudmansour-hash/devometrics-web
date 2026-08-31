// Split out from actions.ts: a "use server" file may only export async
// functions — Next.js's server-actions compiler rejects plain constant
// exports from such a module (it silently produces "the module has no
// exports at all" at build time), so these live here instead.
export const KNOWLEDGE_HUB_BUCKET = "knowledge-hub-docs";
export const KNOWLEDGE_HUB_MAX_BYTES = 50 * 1024 * 1024; // 50MB — Supabase Free plan's hard ceiling
export const KNOWLEDGE_HUB_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Video templates (e.g. a recorded walkthrough or training clip) — still
  // capped at KNOWLEDGE_HUB_MAX_BYTES, which is the real ceiling on
  // Supabase's current Free plan regardless of this bucket's own config;
  // raising it needs the paid plan (see the size conversation this came
  // out of — storage is cheap, egress from repeated viewing is the real
  // cost driver for video specifically).
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
