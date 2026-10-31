import { describe, expect, it } from "vitest";
import {
  averageEvidence,
  combineEvidence,
  confidenceFor,
  gapAgainstRange,
  isAnswered,
  normalizeForQuote,
  quoteIsInAnswer,
  resultFromEvidence,
  validateJudgements,
  wordCount,
  type ItemJudgement,
} from "./scoring";

const item = (a: number, b: number, c: number, d: number, e: number, insufficient = false): ItemJudgement => ({ shown: [a, b, c, d, e] as ItemJudgement["shown"], insufficient });

describe("answers and quotes", () => {
  it("counts words and the minimum for an answered item", () => {
    expect(wordCount("  one two  three ")).toBe(3);
    expect(isAnswered("I talk to them.")).toBe(false);
    expect(isAnswered("I would check the electrical side first and then the suction side.")).toBe(true);
    expect(isAnswered(null)).toBe(false);
  });
  it("matches a quote against the answer despite spacing, quotes and Arabic diacritics", () => {
    expect(quoteIsInAnswer("check  the electrical side", "I would check the electrical side first.")).toBe(true);
    expect(quoteIsInAnswer("explain a delay to a manager", "I would check the electrical side first.")).toBe(false);
    expect(quoteIsInAnswer("", "anything")).toBe(false);
    expect(quoteIsInAnswer("يُجري الفحص", "هو يجري الفحص أولًا")).toBe(true);
    expect(normalizeForQuote("“a”  ‘b’")).toBe("\"a\" 'b'");
  });
});

describe("evidence", () => {
  it("averages usable items and needs at least two", () => {
    expect(averageEvidence([item(2, 2, 0, 0, 0), item(2, 0, 0, 0, 0), item(0, 0, 0, 0, 0, true)])).toEqual([2, 1, 0, 0, 0]);
    expect(averageEvidence([item(2, 2, 2, 0, 0)])).toBeNull();
    expect(averageEvidence([item(2, 2, 2, 0, 0), item(1, 1, 1, 0, 0, true)])).toBeNull();
  });
  it("combines judgements of the same answers, and fails if any is missing", () => {
    expect(combineEvidence([[2, 2, 1, 0, 0], [2, 1, 1, 1, 0]])).toEqual([2, 1.5, 1, 0.5, 0]);
    expect(combineEvidence([[2, 2, 1, 0, 0], null])).toBeNull();
    expect(combineEvidence([])).toBeNull();
  });
});

describe("level, score and range", () => {
  it("is Not assessed without evidence, and never a zero score", () => {
    expect(resultFromEvidence(null)).toEqual({ status: "not_assessed", reason: "insufficient_evidence" });
    expect(resultFromEvidence(null, "too_few_answers")).toEqual({ status: "not_assessed", reason: "too_few_answers" });
    expect(resultFromEvidence([0.5, 0.5, 0, 0, 0])).toEqual({ status: "not_assessed", reason: "no_level_reached" });
  });
  it("takes the highest level that is at least partly shown; lower levels are implied", () => {
    const r = resultFromEvidence([0, 0.3, 1.7, 0, 0]);
    expect(r.status).toBe("scored");
    if (r.status === "scored") expect(r.level).toBe(3);
  });
  it("keeps the score inside the band of the level", () => {
    const hi = resultFromEvidence([2, 2, 2, 0, 0]);
    const lo = resultFromEvidence([0, 0, 1, 0, 0]);
    if (hi.status !== "scored" || lo.status !== "scored") throw new Error("expected scored");
    expect(hi.level).toBe(3);
    expect(hi.score).toBeGreaterThanOrEqual(41);
    expect(hi.score).toBeLessThanOrEqual(60);
    expect(lo.score).toBe(41); // only just reaches level 3 and shows nothing of level 4
    expect(hi.score).toBeGreaterThan(lo.score);
  });
  it("scores higher when more of the next level is shown", () => {
    const a = resultFromEvidence([0, 0, 1.5, 0, 0]);
    const b = resultFromEvidence([0, 0, 1.5, 0.8, 0]);
    if (a.status !== "scored" || b.status !== "scored") throw new Error("expected scored");
    expect(b.score).toBeGreaterThan(a.score);
  });
  it("shows a range at a boundary and a single level otherwise", () => {
    const boundary = resultFromEvidence([0, 0, 1.1, 0.8, 0]);
    const clear = resultFromEvidence([0, 0, 2, 0.2, 0]);
    if (boundary.status !== "scored" || clear.status !== "scored") throw new Error("expected scored");
    expect([boundary.rangeLow, boundary.level, boundary.rangeHigh]).toEqual([2, 3, 4]);
    expect([clear.rangeLow, clear.level, clear.rangeHigh]).toEqual([3, 3, 3]);
    expect(boundary.scoreLow).toBeLessThanOrEqual(boundary.score);
    expect(boundary.scoreHigh).toBeGreaterThanOrEqual(boundary.score);
    expect(clear.scoreLow).toBe(clear.score);
  });
  it("handles the top and bottom levels", () => {
    const top = resultFromEvidence([2, 2, 2, 2, 2]);
    const bottom = resultFromEvidence([1.2, 0, 0, 0, 0]);
    if (top.status !== "scored" || bottom.status !== "scored") throw new Error("expected scored");
    expect(top.level).toBe(5);
    expect(top.rangeHigh).toBe(5);
    expect(top.score).toBeLessThanOrEqual(100);
    expect(bottom.level).toBe(1);
    expect(bottom.rangeLow).toBe(1);
    expect(bottom.score).toBeGreaterThanOrEqual(1);
  });
});

describe("gap against a range", () => {
  const r = resultFromEvidence([0, 0, 1.1, 0.8, 0]); // levels 2 to 4, demonstrated 3
  it("is none when the requirement is at or below the range", () => {
    expect(gapAgainstRange(2, r)).toEqual({ kind: "none", atLeastLevels: 0 });
  });
  it("is close when the requirement lies inside the range", () => {
    expect(gapAgainstRange(3, r)).toEqual({ kind: "close", atLeastLevels: 0 });
    expect(gapAgainstRange(4, r)).toEqual({ kind: "close", atLeastLevels: 0 });
  });
  it("is a gap of at least N levels above the range", () => {
    expect(gapAgainstRange(5, r)).toEqual({ kind: "gap", atLeastLevels: 1 });
  });
  it("is nothing when not required or not assessed", () => {
    expect(gapAgainstRange(0, r)).toBeNull();
    expect(gapAgainstRange(null, r)).toBeNull();
    expect(gapAgainstRange(4, resultFromEvidence(null))).toBeNull();
  });
});

describe("confidence", () => {
  it("is high only with every item answered, consistent items and enough writing", () => {
    expect(confidenceFor({ answered: 3, total: 3, perItemLevels: [3, 3, 4], avgWords: 60 }).label).toBe("high");
    expect(confidenceFor({ answered: 3, total: 3, perItemLevels: [3, 3, 4], avgWords: 20 }).label).toBe("medium");
    expect(confidenceFor({ answered: 3, total: 3, perItemLevels: [1, 3, 5], avgWords: 80 }).label).toBe("low");
    expect(confidenceFor({ answered: 2, total: 3, perItemLevels: [3, 3], avgWords: 80 }).label).toBe("medium");
  });
});

describe("validating the AI output", () => {
  const answers = ["I would check the electrical side first.", "I plan a stop for the minor fault.", "I follow the maker's schedule."];
  const level = (l: number, shown: number, quote = "") => ({ level: l, shown, quote });
  const good = (n: number, shown: number, quote: string) => ({ item: n, levels: [level(1, 0), level(2, 0), level(3, shown, quote), level(4, 0), level(5, 0)] });

  it("accepts a well-formed result and keeps verified evidence", () => {
    const v = validateJudgements([good(1, 2, "check the electrical side"), good(2, 1, "plan a stop"), good(3, 0, "")], answers);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.items[0].shown[2]).toBe(2);
      expect(v.quotesChecked).toBe(2);
      expect(v.quotesRejected).toBe(0);
    }
  });
  it("counts a judgement as not shown when its quote is not in the answer, without failing", () => {
    const v = validateJudgements([good(1, 2, "explain a delay to a senior manager"), good(2, 1, "plan a stop"), good(3, 0, "")], answers);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.items[0].shown[2]).toBe(0);
      expect(v.quotesRejected).toBe(1);
    }
  });
  it("fails on structural problems", () => {
    expect(validateJudgements(null, answers).ok).toBe(false);
    expect(validateJudgements([good(1, 2, "x")], answers).ok).toBe(false);
    expect(validateJudgements([good(1, 0, ""), good(1, 0, ""), good(3, 0, "")], answers).ok).toBe(false); // repeated item
    expect(validateJudgements([good(1, 0, ""), good(2, 0, ""), good(9, 0, "")], answers).ok).toBe(false);
    expect(validateJudgements([good(1, 0, ""), good(2, 0, ""), { item: 3, levels: [level(1, 0)] }], answers).ok).toBe(false);
    expect(validateJudgements([good(1, 0, ""), good(2, 0, ""), good(3, 5, "x")], answers).ok).toBe(false); // shown out of range
  });
  it("keeps items in the order of the answers whatever order the AI returned them", () => {
    const v = validateJudgements([good(3, 0, ""), good(1, 2, "check the electrical side"), good(2, 0, "")], answers);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.items[0].shown[2]).toBe(2);
  });
});
