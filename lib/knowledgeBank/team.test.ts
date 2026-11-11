import { describe, expect, it } from "vitest";
import { aggregateTeam, type TeamInputRow } from "./team";
import type { CheckResult } from "./engine";

const result = (percent: number, per: [string, number, number][]): CheckResult => ({
  asked: per.reduce((n, p) => n + p[1], 0),
  answered: per.reduce((n, p) => n + p[1], 0),
  correct: per.reduce((n, p) => n + p[2], 0),
  percent,
  perCompetency: per.map(([competencyKey, asked, correct]) => ({ competencyKey, requiredLevel: 3, asked, correct })),
});
const row = (userId: string, name: string, at: string, r: CheckResult): TeamInputRow => ({ checkId: `c-${userId}-${at}`, userId, name, roleTitle: "CSM", submittedAt: at, result: r, timing: null });

describe("team results", () => {
  it("is empty for no checks", () => {
    expect(aggregateTeam([])).toEqual({ people: [], competencies: [], averagePercent: null, counts: { strong: 0, adequate: 0, gaps: 0 } });
  });

  it("counts each person once, by their most recent check", () => {
    const t = aggregateTeam([
      row("a", "Ann", "2026-11-01T10:00:00Z", result(25, [["x", 4, 1]])),
      row("a", "Ann", "2026-11-09T10:00:00Z", result(100, [["x", 4, 4]])),
      row("b", "Bo", "2026-11-05T10:00:00Z", result(50, [["x", 4, 2]])),
    ]);
    expect(t.people.map((p) => [p.name, p.percent])).toEqual([["Ann", 100], ["Bo", 50]]);
    expect(t.competencies[0]).toMatchObject({ competencyKey: "x", asked: 8, correct: 6, percent: 75, people: 2 });
  });

  it("lists the weakest competency first", () => {
    const t = aggregateTeam([
      row("a", "Ann", "2026-11-01T10:00:00Z", result(60, [["strong", 4, 4], ["weak", 4, 1], ["mid", 4, 3]])),
      row("b", "Bo", "2026-11-01T10:00:00Z", result(60, [["strong", 4, 4], ["weak", 4, 1], ["mid", 4, 3]])),
    ]);
    expect(t.competencies.map((c) => c.competencyKey)).toEqual(["weak", "mid", "strong"]);
    expect(t.competencies.map((c) => c.reading)).toEqual(["gaps", "adequate", "strong"]);
  });

  it("sorts people best first, then by name, and counts the three bands", () => {
    const t = aggregateTeam([
      row("a", "Zed", "2026-11-01T10:00:00Z", result(90, [["x", 4, 4]])),
      row("b", "Amy", "2026-11-01T10:00:00Z", result(90, [["x", 4, 4]])),
      row("c", "Cat", "2026-11-01T10:00:00Z", result(65, [["x", 4, 3]])),
      row("d", "Dan", "2026-11-01T10:00:00Z", result(20, [["x", 4, 1]])),
    ]);
    expect(t.people.map((p) => p.name)).toEqual(["Amy", "Zed", "Cat", "Dan"]);
    expect(t.counts).toEqual({ strong: 2, adequate: 1, gaps: 1 });
    expect(t.averagePercent).toBe(66);
  });

  it("ignores a competency nobody was asked about", () => {
    const t = aggregateTeam([row("a", "Ann", "2026-11-01T10:00:00Z", result(100, [["x", 0, 0], ["y", 2, 2]]))]);
    expect(t.competencies.map((c) => c.competencyKey)).toEqual(["y"]);
  });

  it("counts how many people each competency covers", () => {
    const t = aggregateTeam([
      row("a", "Ann", "2026-11-01T10:00:00Z", result(100, [["x", 2, 2], ["y", 2, 2]])),
      row("b", "Bo", "2026-11-01T10:00:00Z", result(100, [["x", 2, 2]])),
    ]);
    expect(t.competencies.find((c) => c.competencyKey === "x")!.people).toBe(2);
    expect(t.competencies.find((c) => c.competencyKey === "y")!.people).toBe(1);
  });
});
