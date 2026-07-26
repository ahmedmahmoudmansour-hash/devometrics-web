export const CANDIDATE_CV_BUCKET = "candidate-cvs";

// Matches migration 0088's storage bucket allowlist and
// lib/fileExtraction/extract.ts's MAX_FILE_SIZE_BYTES exactly.
export const CANDIDATE_CV_MAX_BYTES = 8 * 1024 * 1024;
export const CANDIDATE_CV_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
