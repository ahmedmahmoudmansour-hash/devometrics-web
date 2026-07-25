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
] as const;
