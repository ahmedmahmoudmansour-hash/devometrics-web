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

// The raw zip itself is capped separately by KNOWLEDGE_HUB_MAX_BYTES_SCORM
// (lib/knowledgeHub/constants.ts) — kept deliberately below the video tier
// even at full scale, because everything below still runs synchronously in
// one request; see that file's comment for why SCORM wasn't raised to match
// video, and for why that constant (and these two below) are TEMPORARILY
// held down at 50MB/150MB/20MB (2026-09-02) rather than their real
// 200MB/250MB/100MB targets — the org's Supabase project is still on the
// Free plan, which hard-caps every upload at 50MB regardless of app config.
// Flip these back to the commented real values the moment it upgrades to
// Pro; the interleaved extract-and-upload-per-file refactor below (and its
// partial-failure cleanup) stays correct at either scale.
export const SCORM_MAX_UNCOMPRESSED_BYTES = 150 * 1024 * 1024; // real target: 250MB
export const SCORM_MAX_FILE_COUNT = 500;
export const SCORM_MAX_FILE_BYTES = 20 * 1024 * 1024; // real target: 100MB
// Reject an entry whose declared uncompressedSize:compressedSize ratio
// exceeds this — the standard zip-bomb tell (a tiny compressed stream
// claiming to inflate to something enormous), catchable from metadata
// alone, no decompression required.
export const SCORM_MAX_COMPRESSION_RATIO = 100;
// 45s, leaving headroom under the 60s maxDuration set on ingest.ts (matches
// the app/api/trends and app/api/courses route precedent). Left at this more
// generous value (raised from an original 20s) even while the size limits
// above are temporarily held down — extra headroom is harmless at any scale,
// and it's one less thing to remember to re-raise later.
export const SCORM_PROCESSING_BUDGET_MS = 45_000;
