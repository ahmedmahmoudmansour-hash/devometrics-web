// Time limit and "left the page" bookkeeping for a knowledge check. Pure, so it is tested without a database.
//
// The facts are kept inside the check's existing `answers` JSON under a reserved key, so no database change is needed:
//   answers = { "hr.recruitment#2": 1, ..., "__meta": { startedAt: <epoch ms, set by the server>, leftPage: 2, late: false } }
// Question ids look like "competency.key#level", so they can never collide with "__meta". Scoring only ever looks answers up
// by question id, so the extra key changes no score.
//
// This is a deterrent, not proctoring: it cannot stop someone using a second device. It makes looking things up slow and
// leaves a visible trace (time used, times the page was left, late submission) for the manager.

export const META_KEY = "__meta";
export const SECONDS_PER_QUESTION = 75;
// A submission may arrive a little after the clock hits zero (the page submits itself, then the network takes time).
export const GRACE_SECONDS = 60;
const MAX_LEFT = 999;

export type CheckMeta = { startedAt?: number; leftPage?: number; late?: boolean };

export function limitSeconds(questionCount: number): number {
  const n = Number.isFinite(questionCount) ? Math.max(0, Math.round(questionCount)) : 0;
  return Math.max(60, n * SECONDS_PER_QUESTION);
}

export function readMeta(answers: unknown): CheckMeta {
  if (!answers || typeof answers !== "object") return {};
  const raw = (answers as Record<string, unknown>)[META_KEY];
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const meta: CheckMeta = {};
  if (typeof r.startedAt === "number" && Number.isFinite(r.startedAt) && r.startedAt > 0) meta.startedAt = r.startedAt;
  if (typeof r.leftPage === "number" && Number.isFinite(r.leftPage) && r.leftPage > 0) meta.leftPage = Math.min(MAX_LEFT, Math.floor(r.leftPage));
  if (typeof r.late === "boolean") meta.late = r.late;
  return meta;
}

// The answers with the bookkeeping attached (or without it, when there is none).
export function withMeta(answers: Record<string, number>, meta: CheckMeta): Record<string, unknown> {
  const clean: CheckMeta = {};
  if (meta.startedAt !== undefined) clean.startedAt = meta.startedAt;
  if (meta.leftPage !== undefined && meta.leftPage > 0) clean.leftPage = Math.min(MAX_LEFT, Math.floor(meta.leftPage));
  if (meta.late !== undefined) clean.late = meta.late;
  return Object.keys(clean).length > 0 ? { ...answers, [META_KEY]: clean } : { ...answers };
}

export function remainingSeconds(startedAt: number, limit: number, now: number): number {
  return Math.max(0, Math.ceil((startedAt + limit * 1000 - now) / 1000));
}

export function isLate(startedAt: number, limit: number, submittedAt: number): boolean {
  return submittedAt > startedAt + (limit + GRACE_SECONDS) * 1000;
}

export type Timing = { usedSeconds: number; limitSeconds: number; leftPage: number; late: boolean };

// What a manager sees on a finished check, or null for one taken before the timer existed.
export function timingOf(answers: unknown, questionCount: number, submittedAtMs: number): Timing | null {
  const meta = readMeta(answers);
  if (meta.startedAt === undefined) return null;
  const limit = limitSeconds(questionCount);
  return {
    usedSeconds: Math.max(0, Math.round((submittedAtMs - meta.startedAt) / 1000)),
    limitSeconds: limit,
    leftPage: meta.leftPage ?? 0,
    late: meta.late ?? isLate(meta.startedAt, limit, submittedAtMs),
  };
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
