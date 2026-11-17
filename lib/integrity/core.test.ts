import { describe, expect, it } from "vitest";
import {
  BULK_INSERT_CHARS, formatClock, hasSignals, isIntegrityKind, mapRow, newTypingState, readTyping, registerChange, remainingSeconds, roleTimeLimit, summarize, testTimeLimit, typingSummary,
  type IntegrityDbRow,
} from "./core";

const db = (over: Partial<IntegrityDbRow> = {}): IntegrityDbRow => ({
  attested_at: "2026-11-17T10:00:00Z", started_at: "2026-11-17T10:00:00Z", time_limit_seconds: 300, left_page_count: 0, away_seconds: 0, typing: {}, finished_at: null, late: null, ...over,
});

describe("kinds", () => {
  it("accepts the five kinds and nothing else", () => {
    for (const k of ["role", "knowledge_check", "cognitive", "english", "case_study"]) expect(isIntegrityKind(k)).toBe(true);
    for (const k of ["", "Role", "quiz", null, 5, undefined]) expect(isIntegrityKind(k)).toBe(false);
  });
});

describe("time limits", () => {
  it("gives a role assessment five minutes per competency", () => {
    expect(roleTimeLimit(6)).toBe(1800);
    expect(roleTimeLimit(0)).toBe(60);
  });
  it("gives cognitive and English 45 seconds a question, never under five minutes", () => {
    expect(testTimeLimit(54)).toBe(2430);
    expect(testTimeLimit(3)).toBe(300);
  });
  it("counts down to zero and stops", () => {
    expect(remainingSeconds(0, 300, 100_000)).toBe(200);
    expect(remainingSeconds(0, 300, 400_000)).toBe(0);
    expect(remainingSeconds(0, 10, 9_500)).toBe(1);
  });
  it("formats a clock", () => {
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(-3)).toBe("0:00");
  });
});

describe("reading a row", () => {
  it("maps the database row to the screen's shape", () => {
    const r = mapRow(db({ left_page_count: 2, away_seconds: 70, typing: { answers: 3, chars: 900, bulkInserts: 1 } }));
    expect(r).toMatchObject({ leftPage: 2, awaySeconds: 70, timeLimitSeconds: 300 });
    expect(r.typing).toEqual({ answers: 3, chars: 900, bulkInserts: 1, flagged: true });
  });
  it("treats a missing or junk typing summary as none", () => {
    expect(readTyping(null)).toBeNull();
    expect(readTyping({})).toBeNull();
    expect(readTyping({ answers: "x", chars: -4, bulkInserts: "no" })).toEqual({ answers: 0, chars: 0, bulkInserts: 0, flagged: false });
  });
});

describe("summary for a manager", () => {
  it("is unfinished until the sitting is finished, with no time used", () => {
    const s = summarize(mapRow(db()));
    expect(s).toMatchObject({ finished: false, usedSeconds: null, attested: true, late: false });
  });
  it("reports time used, leaves, lateness and bulk text", () => {
    const s = summarize(mapRow(db({ finished_at: "2026-11-17T10:04:30Z", late: false, left_page_count: 3, away_seconds: 95, typing: { answers: 2, chars: 400, bulkInserts: 1 } })));
    expect(s).toMatchObject({ finished: true, usedSeconds: 270, limitSeconds: 300, leftPage: 3, awaySeconds: 95, late: false, bulkInserts: 1 });
  });
  it("marks late only when the database said so", () => {
    expect(summarize(mapRow(db({ finished_at: "2026-11-17T11:00:00Z", late: true }))).late).toBe(true);
    expect(summarize(mapRow(db({ finished_at: "2026-11-17T11:00:00Z", late: null }))).late).toBe(false);
  });
  it("flags attention for any signal, or a missing promise, and for nothing else", () => {
    const calm = summarize(mapRow(db({ finished_at: "2026-11-17T10:03:00Z", late: false })));
    expect(hasSignals(calm)).toBe(false);
    expect(hasSignals({ ...calm, leftPage: 1 })).toBe(true);
    expect(hasSignals({ ...calm, late: true })).toBe(true);
    expect(hasSignals({ ...calm, bulkInserts: 1 })).toBe(true);
    expect(hasSignals({ ...calm, attested: false })).toBe(true);
  });
});

describe("typing evidence", () => {
  it("does not flag ordinary typing, autocorrect or predictive text", () => {
    const s = newTypingState();
    let len = 0;
    for (const add of [1, 1, 1, 6, 1, 12, 1, 9]) {
      registerChange(s, "q1", len, len + add);
      len += add;
    }
    expect(typingSummary(s)).toMatchObject({ answers: 1, bulkInserts: 0, flagged: false });
  });
  it("flags text that arrives in one large piece", () => {
    const s = newTypingState();
    registerChange(s, "q1", 0, BULK_INSERT_CHARS);
    registerChange(s, "q2", 10, 10 + BULK_INSERT_CHARS + 200);
    expect(typingSummary(s)).toMatchObject({ answers: 2, bulkInserts: 2, flagged: true });
  });
  it("does not count deleting text, or a small change at the threshold's edge", () => {
    const s = newTypingState();
    registerChange(s, "q1", 300, 100);
    registerChange(s, "q1", 100, 100 + BULK_INSERT_CHARS - 1);
    expect(typingSummary(s).bulkInserts).toBe(0);
  });
  it("adds up characters over answers, counting only answers that have text", () => {
    const s = newTypingState();
    registerChange(s, "a", 0, 5);
    registerChange(s, "b", 0, 7);
    registerChange(s, "c", 3, 0);
    expect(typingSummary(s)).toMatchObject({ answers: 2, chars: 12 });
  });
});
