// The conditions an assessment was taken under: pure helpers shared by the server actions, the screens and the tests.
// Signals for a conversation, never proof: nothing here decides anything about a person.

export type IntegrityKind = "role" | "knowledge_check" | "cognitive" | "english" | "case_study";
export const INTEGRITY_KINDS: readonly IntegrityKind[] = ["role", "knowledge_check", "cognitive", "english", "case_study"];
export const isIntegrityKind = (k: unknown): k is IntegrityKind => typeof k === "string" && (INTEGRITY_KINDS as readonly string[]).includes(k);

export const SECONDS_PER_COMPETENCY = 300; // role assessment: 5 minutes for each competency
export const SECONDS_PER_TEST_QUESTION = 45; // cognitive and English: 45 seconds a question
export const GRACE_SECONDS = 60; // same grace as the database applies when it works out "late"

export type TypingSummary = { answers: number; chars: number; bulkInserts: number; flagged: boolean };

// A row as the database holds it (snake_case) and as the screens use it.
export type IntegrityDbRow = {
  attested_at: string | null;
  started_at: string;
  time_limit_seconds: number | null;
  left_page_count: number;
  away_seconds: number;
  typing: Record<string, unknown> | null;
  finished_at: string | null;
  late: boolean | null;
};

export type IntegrityRow = {
  attestedAt: string | null;
  startedAt: string;
  timeLimitSeconds: number | null;
  leftPage: number;
  awaySeconds: number;
  typing: TypingSummary | null;
  finishedAt: string | null;
  late: boolean | null;
};

// What the page is told: whether recording is available at all (it is not until migration 0210 is applied, and the assessment
// then simply runs without it), the sitting so far, and the server's clock so the countdown does not trust the person's device.
export type IntegrityState = { available: boolean; row: IntegrityRow | null; serverNow: number };

export function readTyping(raw: unknown): TypingSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  if (r.answers === undefined && r.chars === undefined && r.bulkInserts === undefined) return null;
  const bulkInserts = num(r.bulkInserts);
  return { answers: num(r.answers), chars: num(r.chars), bulkInserts, flagged: bulkInserts > 0 };
}

export function mapRow(r: IntegrityDbRow): IntegrityRow {
  return {
    attestedAt: r.attested_at,
    startedAt: r.started_at,
    timeLimitSeconds: r.time_limit_seconds,
    leftPage: r.left_page_count,
    awaySeconds: r.away_seconds,
    typing: readTyping(r.typing),
    finishedAt: r.finished_at,
    late: r.late,
  };
}

export function remainingSeconds(startedAtMs: number, limitSeconds: number, nowMs: number): number {
  return Math.max(0, Math.ceil((startedAtMs + limitSeconds * 1000 - nowMs) / 1000));
}

export const roleTimeLimit = (competencyCount: number) => Math.max(60, Math.round(competencyCount) * SECONDS_PER_COMPETENCY);
// Cognitive and English: 45 s a question, and never less than 5 minutes.
export const testTimeLimit = (questionCount: number) => Math.max(300, Math.round(questionCount) * SECONDS_PER_TEST_QUESTION);

export type IntegritySummary = {
  attested: boolean;
  usedSeconds: number | null; // null until finished
  limitSeconds: number | null;
  leftPage: number;
  awaySeconds: number;
  late: boolean;
  bulkInserts: number;
  finished: boolean;
};

export function summarize(row: IntegrityRow): IntegritySummary {
  const finished = !!row.finishedAt;
  return {
    attested: !!row.attestedAt,
    usedSeconds: finished ? Math.max(0, Math.round((Date.parse(row.finishedAt as string) - Date.parse(row.startedAt)) / 1000)) : null,
    limitSeconds: row.timeLimitSeconds,
    leftPage: row.leftPage,
    awaySeconds: row.awaySeconds,
    late: row.late === true,
    bulkInserts: row.typing?.bulkInserts ?? 0,
    finished,
  };
}

// Anything worth a manager's attention? (Drives a quiet marker in lists; never a verdict.)
export const hasSignals = (s: IntegritySummary) => s.late || s.leftPage > 0 || s.bulkInserts > 0 || !s.attested;

// ---- typing evidence --------------------------------------------------------------------------------------------------------
// Pasting is blocked, so what remains to notice is text that still arrives in one large piece: dictation, a drag-and-drop, or a
// tool inserting a finished paragraph. Ordinary typing, autocorrect and predictive text add a word or two at a time.
export const BULK_INSERT_CHARS = 40;

export type TypingState = { chars: Record<string, number>; bulkInserts: number };
export const newTypingState = (): TypingState => ({ chars: {}, bulkInserts: 0 });

export function registerChange(state: TypingState, answerId: string, previousLength: number, nextLength: number): void {
  const prev = Math.max(0, previousLength);
  const next = Math.max(0, nextLength);
  state.chars[answerId] = next;
  if (next - prev >= BULK_INSERT_CHARS) state.bulkInserts += 1;
}

export function typingSummary(state: TypingState): TypingSummary {
  const lengths = Object.values(state.chars);
  return { answers: lengths.filter((n) => n > 0).length, chars: lengths.reduce((a, b) => a + b, 0), bulkInserts: state.bulkInserts, flagged: state.bulkInserts > 0 };
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
