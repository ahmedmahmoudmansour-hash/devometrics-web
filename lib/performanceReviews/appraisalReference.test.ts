import { describe, expect, it } from "vitest";
import { cleanLevelDescriptions, latestScoredPerCompetency, type ResultRow } from "./appraisalReference";

const base: ResultRow = {
  competency_key: "Communication",
  status: "scored",
  level: 3,
  range_low: 3,
  range_high: 4,
  confidence: "medium",
  confirmed_at: null,
  override_level: null,
  scored_at: "2026-10-01T10:00:00Z",
};

describe("latestScoredPerCompetency", () => {
  it("keeps the newest scored result per competency", () => {
    const out = latestScoredPerCompetency([
      { ...base, level: 2, range_low: 2, range_high: 2, scored_at: "2026-09-01T10:00:00Z" },
      { ...base, level: 4, range_low: 4, range_high: 4, scored_at: "2026-10-20T10:00:00Z" },
    ]);
    expect(out.Communication.level).toBe(4);
  });

  it("does not let a later 'not assessed' or failed result hide an earlier real one", () => {
    const out = latestScoredPerCompetency([
      base,
      { ...base, status: "not_assessed", level: null, range_low: null, range_high: null, confidence: null, scored_at: "2026-11-01T10:00:00Z" },
      { ...base, status: "scoring_failed", level: null, range_low: null, range_high: null, confidence: null, scored_at: "2026-11-02T10:00:00Z" },
    ]);
    expect(out.Communication.level).toBe(3);
    expect(out.Communication.scoredAt).toBe("2026-10-01T10:00:00Z");
  });

  it("uses a manager's override as the level and collapses the range", () => {
    const out = latestScoredPerCompetency([{ ...base, override_level: 2, confirmed_at: "2026-10-02T10:00:00Z" }]);
    expect(out.Communication).toMatchObject({ level: 2, rangeLow: 2, rangeHigh: 2, overridden: true, confirmed: true });
  });

  it("marks an unconfirmed result as unconfirmed", () => {
    expect(latestScoredPerCompetency([base]).Communication.confirmed).toBe(false);
  });

  it("ignores rows with an unknown confidence value instead of guessing", () => {
    expect(latestScoredPerCompetency([{ ...base, confidence: "certain" }])).toEqual({});
  });

  it("returns nothing for a person with no results", () => {
    expect(latestScoredPerCompetency([])).toEqual({});
  });
});

describe("cleanLevelDescriptions", () => {
  it("keeps only written levels, trimmed", () => {
    expect(cleanLevelDescriptions({ "1": " first ", "2": "", "3": "third", "9": "ignored", "4": 5 })).toEqual({ "1": "first", "3": "third" });
  });

  it("returns null when nothing is written or the input is not an object", () => {
    expect(cleanLevelDescriptions({ "1": " ", "2": "" })).toBeNull();
    expect(cleanLevelDescriptions(null)).toBeNull();
    expect(cleanLevelDescriptions("text")).toBeNull();
  });
});
