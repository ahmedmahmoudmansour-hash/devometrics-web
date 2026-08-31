// Hard safety limits for SCORM package ingestion (migration 0149's
// content_type='scorm' flow) — every one of these is checked against the
// zip's own declared central-directory metadata (via yauzl, which parses
// that metadata without inflating anything) BEFORE the corresponding
// entry's bytes are ever decompressed. See ingest.ts's extractScormZip.
//
// No async job runner exists anywhere in this codebase (no Supabase Edge
// Functions, no queue — Vercel Hobby's cron is already at its 2-job cap),
// so this all happens synchronously inside one server action's request —
// SCORM_PROCESSING_BUDGET_MS exists specifically to fail fast and
// predictably rather than let that request hang toward a serverless
// timeout.

// The zip itself is already capped by the knowledge-hub-docs bucket's own
// file_size_limit (KNOWLEDGE_HUB_MAX_BYTES, 50MB) — no separate zip-size
// constant needed here.
export const SCORM_MAX_UNCOMPRESSED_BYTES = 150 * 1024 * 1024;
export const SCORM_MAX_FILE_COUNT = 500;
export const SCORM_MAX_FILE_BYTES = 20 * 1024 * 1024;
// Reject an entry whose declared uncompressedSize:compressedSize ratio
// exceeds this — the standard zip-bomb tell (a tiny compressed stream
// claiming to inflate to something enormous), catchable from metadata
// alone, no decompression required.
export const SCORM_MAX_COMPRESSION_RATIO = 100;
export const SCORM_PROCESSING_BUDGET_MS = 20_000;
