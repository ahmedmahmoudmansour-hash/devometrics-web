import { describe, expect, it } from "vitest";
import { getQuestion } from "./index";
import { scoreCheck } from "./engine";
import { GRACE_SECONDS, META_KEY, SECONDS_PER_QUESTION, formatClock, isLate, limitSeconds, readMeta, remainingSeconds, timingOf, withMeta } from "./timer";

describe("time limit", () => {
  it("gives 75 seconds per question, never less than a minute", () => {
    expect(limitSeconds(4)).toBe(4 * SECONDS_PER_QUESTION);
    expect(limitSeconds(40)).toBe(3000);
    expect(limitSeconds(0)).toBe(60);
    expect(limitSeconds(Number.NaN)).toBe(60);
  });
  it("counts down to zero and stops there", () => {
    expect(remainingSeconds(1_000_000, 300, 1_000_000)).toBe(300);
    expect(remainingSeconds(1_000_000, 300, 1_000_000 + 100_000)).toBe(200);
    expect(remainingSeconds(1_000_000, 300, 1_000_000 + 900_000)).toBe(0);
  });
  it("rounds a part second up, so the clock never shows 0:00 while time remains", () => {
    expect(remainingSeconds(0, 10, 9_500)).toBe(1);
  });
  it("is late only after the limit plus the grace period", () => {
    const start = 1_000_000;
    expect(isLate(start, 300, start + 300_000)).toBe(false);
    expect(isLate(start, 300, start + (300 + GRACE_SECONDS) * 1000)).toBe(false);
    expect(isLate(start, 300, start + (300 + GRACE_SECONDS) * 1000 + 1)).toBe(true);
  });
  it("formats a clock", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(3000)).toBe("50:00");
    expect(formatClock(-5)).toBe("0:00");
  });
});

describe("bookkeeping kept inside the answers", () => {
  it("reads nothing from answers that have no meta, or junk", () => {
    expect(readMeta(null)).toEqual({});
    expect(readMeta({})).toEqual({});
    expect(readMeta({ [META_KEY]: "x" })).toEqual({});
    expect(readMeta({ [META_KEY]: { startedAt: "soon", leftPage: -3, late: "yes" } })).toEqual({});
  });
  it("reads and bounds real values", () => {
    expect(readMeta({ [META_KEY]: { startedAt: 123456, leftPage: 2.9, late: true } })).toEqual({ startedAt: 123456, leftPage: 2, late: true });
    expect(readMeta({ [META_KEY]: { leftPage: 5000 } }).leftPage).toBe(999);
  });
  it("attaches meta without touching the answers, and attaches nothing when there is none", () => {
    expect(withMeta({ "a#2": 1 }, { startedAt: 5, leftPage: 1 })).toEqual({ "a#2": 1, [META_KEY]: { startedAt: 5, leftPage: 1 } });
    expect(withMeta({ "a#2": 1 }, {})).toEqual({ "a#2": 1 });
    expect(withMeta({ "a#2": 1 }, { leftPage: 0 })).toEqual({ "a#2": 1 });
  });
  it("does not change the score: only question ids are looked up", () => {
    const ids = ["hr.recruitment#2", "hr.recruitment#3"];
    const keyOf = (id: string) => {
      const k = getQuestion(id);
      return k ? { competencyKey: k.competencyKey, correct: k.correct } : null;
    };
    const right = Object.fromEntries(ids.map((i) => [i, getQuestion(i)!.correct]));
    const plain = scoreCheck(ids, right, keyOf, {});
    const withTimer = scoreCheck(ids, withMeta(right, { startedAt: 9, leftPage: 7, late: true }) as unknown as Record<string, number>, keyOf, {});
    expect(withTimer).toEqual(plain);
    expect(withTimer.percent).toBe(100);
  });
});

describe("what a manager sees", () => {
  it("shows nothing for a check taken before the timer existed", () => {
    expect(timingOf({ "a#2": 1 }, 4, Date.now())).toBeNull();
    expect(timingOf(null, 4, Date.now())).toBeNull();
  });
  it("reports time used, page leaves and lateness", () => {
    const start = 1_000_000;
    const t = timingOf({ [META_KEY]: { startedAt: start, leftPage: 3 } }, 4, start + 120_000)!;
    expect(t).toEqual({ usedSeconds: 120, limitSeconds: 300, leftPage: 3, late: false });
  });
  it("marks a very late submission as late even when the flag was never stored", () => {
    const start = 1_000_000;
    expect(timingOf({ [META_KEY]: { startedAt: start } }, 4, start + 10_000_000)!.late).toBe(true);
  });
  it("prefers the stored late flag", () => {
    const start = 1_000_000;
    expect(timingOf({ [META_KEY]: { startedAt: start, late: false } }, 4, start + 10_000_000)!.late).toBe(false);
  });
});
