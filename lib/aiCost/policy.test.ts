import { describe, expect, it } from "vitest";
import {
  canReuseInsight,
  courseCacheKey,
  growMemoryUpdatePlan,
  isFresh,
  recentCoachHistory,
  type StoredMessage,
} from "./policy";

const msg = (role: string, minute: number, content = "hello"): StoredMessage => ({
  role,
  content,
  created_at: new Date(Date.UTC(2026, 9, 26, 8, minute)).toISOString(),
});

describe("recentCoachHistory", () => {
  it("returns the newest messages oldest first", () => {
    const newestFirst = [{ role: "assistant", n: 4 }, { role: "user", n: 3 }, { role: "assistant", n: 2 }, { role: "user", n: 1 }];
    expect(recentCoachHistory(newestFirst).map((m) => m.n)).toEqual([1, 2, 3, 4]);
  });

  it("starts on a user message", () => {
    const newestFirst = [{ role: "user", n: 3 }, { role: "assistant", n: 2 }, { role: "user", n: 1 }].slice(0, 2);
    expect(recentCoachHistory(newestFirst)[0].role).toBe("user");
  });

  it("copes with nothing", () => {
    expect(recentCoachHistory(null)).toEqual([]);
    expect(recentCoachHistory([])).toEqual([]);
  });
});

describe("growMemoryUpdatePlan", () => {
  it("updates when there is no memory yet", () => {
    expect(growMemoryUpdatePlan(null, []).update).toBe(true);
  });

  it("skips until enough exchanges have built up, then covers all of them", () => {
    const memoryAt = new Date(Date.UTC(2026, 9, 26, 8, 0)).toISOString();
    const two = [msg("user", 1, "a"), msg("assistant", 2, "b"), msg("user", 3, "c"), msg("assistant", 4, "d")];
    expect(growMemoryUpdatePlan(memoryAt, two).update).toBe(false); // 2 earlier + current = 3 turns
    const three = [...two, msg("user", 5, "e"), msg("assistant", 6, "f")];
    const plan = growMemoryUpdatePlan(memoryAt, three);
    expect(plan.update).toBe(true); // 3 earlier + current = 4 turns
    expect(plan.transcript).toContain("User: a");
    expect(plan.transcript).toContain("Coach: f");
  });

  it("ignores exchanges the memory already covers", () => {
    const memoryAt = new Date(Date.UTC(2026, 9, 26, 8, 10)).toISOString();
    const plan = growMemoryUpdatePlan(memoryAt, [msg("user", 1, "old"), msg("assistant", 2, "old reply"), msg("user", 11, "new")]);
    expect(plan.transcript).toBe("User: new");
  });

  it("compares real times, not text", () => {
    const memoryAt = "2026-10-26T08:00:00.000Z"; // written by the app
    const stored = { role: "user", content: "x", created_at: "2026-10-26T08:05:00.123456+00:00" }; // written by the database
    expect(growMemoryUpdatePlan(memoryAt, [stored]).transcript).toBe("User: x");
  });

  it("caps long messages and long transcripts", () => {
    const many = Array.from({ length: 30 }, (_, i) => msg(i % 2 ? "assistant" : "user", i + 1, "z".repeat(900)));
    const { transcript } = growMemoryUpdatePlan(null, many);
    expect(transcript.split("\n")).toHaveLength(12);
    expect(Math.max(...transcript.split("\n").map((l) => l.length))).toBeLessThan(520);
  });
});

describe("canReuseInsight", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  it("reuses an insight made after the latest analysis, while it is recent", () => {
    expect(canReuseInsight({ latestAnalysisCreatedAt: "2026-10-20T09:00:00Z", lastInsightCreatedAt: "2026-10-25T08:00:00Z", now })).toBe(true);
  });
  it("does not reuse when a newer analysis exists", () => {
    expect(canReuseInsight({ latestAnalysisCreatedAt: "2026-10-25T10:00:00Z", lastInsightCreatedAt: "2026-10-25T08:00:00Z", now })).toBe(false);
  });
  it("does not reuse an old insight", () => {
    expect(canReuseInsight({ latestAnalysisCreatedAt: "2026-10-01T09:00:00Z", lastInsightCreatedAt: "2026-10-15T08:00:00Z", now })).toBe(false);
  });
  it("does not reuse when a time is unreadable", () => {
    expect(canReuseInsight({ latestAnalysisCreatedAt: "nope", lastInsightCreatedAt: "2026-10-25T08:00:00Z", now })).toBe(false);
  });
});

describe("course cache", () => {
  it("keys are per person, language and topic, ignoring case and spacing", () => {
    expect(courseCacheKey("u1", "en", "  Public   Speaking ")).toBe("courses:u1:en:public speaking");
    expect(courseCacheKey("u1", "ar", "Public Speaking", "Video")).toBe("courses:u1:ar:public speaking:video");
    expect(courseCacheKey("u1", "en", "x")).not.toBe(courseCacheKey("u2", "en", "x"));
  });
  it("knows when a saved result is still fresh", () => {
    const now = new Date("2026-10-26T00:00:00Z");
    expect(isFresh("2026-10-20T00:00:00Z", 14, now)).toBe(true);
    expect(isFresh("2026-10-01T00:00:00Z", 14, now)).toBe(false);
    expect(isFresh("garbage", 14, now)).toBe(false);
  });
});
