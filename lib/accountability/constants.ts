// Split out from actions.ts: a "use server" file may only export async
// functions — see lib/knowledgeHub/constants.ts for the same reasoning.
export const ACCOUNTABILITY_FILES_BUCKET = "accountability-files";
export const ACCOUNTABILITY_FILE_MAX_BYTES = 20 * 1024 * 1024; // 20MB — well under Supabase Free plan's 50MB ceiling, this is casual peer-shared content, not curated training docs
export const ACCOUNTABILITY_FILE_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "text/plain",
] as const;
