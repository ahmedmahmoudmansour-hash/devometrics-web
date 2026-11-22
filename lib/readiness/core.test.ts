import { describe, expect, it } from "vitest";
import { cellState, computeReadiness, personState, sampleReadiness, type CompetencyCell, type ReadinessAssessment, type ReadinessInput } from "./core";

const cell = (state: CompetencyCell["state"]): CompetencyCell => ({ name: "x", required: 3, demonstrated: 3, state });

describe("one competency", () => {
  it("is met at or above the requirement, close one level below, a gap two or more below", () => {
    expect(cellState(3, 3)).toBe("met");
    expect(cellState(3, 5)).toBe("met");
    expect(cellState(3, 2)).toBe("close");
    expect(cellState(3, 1)).toBe("gap");
    expect(cellState(5, 2)).toBe("gap");
  });
  it("is not assessed when there is no result or no requirement", () => {
    expect(cellState(3, null)).toBe("notAssessed");
    expect(cellState(null, 3)).toBe("notAssessed");
  });
});

describe("one person", () => {
  it("is ready only when every assessed competency is met", () => {
    expect(personState([cell("met"), cell("met")])).toBe("ready");
  });
  it("is close when something is one level short and nothing is further", () => {
    expect(personState([cell("met"), cell("close")])).toBe("close");
  });
  it("has a gap when anything is two or more levels short", () => {
    expect(personState([cell("close"), cell("gap"), cell("met")])).toBe("gap");
  });
  it("is not assessed without any assessed competency", () => {
    expect(personState([])).toBe("notAssessed");
    expect(personState([cell("notAssessed")])).toBe("notAssessed");
  });
});

const base = (): ReadinessInput => ({
  roles: [{ id: "r1", title: "CSM", family: "CS", grade: 6 }],
  members: [
    { userId: "a", name: "Ann", roleId: "r1" },
    { userId: "b", name: "Bo", roleId: "r1" },
    { userId: "c", name: "Cy", roleId: null },
  ],
  assessments: [],
  competencyNames: { v1: "Quality", v2: "Leadership" },
  plansByUser: {},
});
const scored = (userId: string, levels: [number | null, number | null], extra: Partial<ReadinessAssessment> = {}): ReadinessAssessment => ({
  id: `as-${userId}`, userId, roleId: "r1", status: "scored", createdAt: "2026-11-10",
  snapshot: [{ versionId: "v1", requiredLevel: 4 }, { versionId: "v2", requiredLevel: 3 }],
  results: [
    { versionId: "v1", status: levels[0] === null ? "not_assessed" : "scored", level: levels[0], overrideLevel: null },
    { versionId: "v2", status: levels[1] === null ? "not_assessed" : "scored", level: levels[1], overrideLevel: null },
  ],
  ...extra,
});

describe("readiness of a company", () => {
  it("guides the first step when there is nothing yet", () => {
    const r = computeReadiness({ ...base(), roles: [], members: [], assessments: [] });
    expect(r.next).toEqual({ key: "roles", href: "/dashboard/company/job-architecture" });
    expect(r.roles).toEqual([]);
    expect(r.kpis.readyPercent).toBeNull();
  });
  it("asks to place people in jobs next, and counts who is placed", () => {
    const r = computeReadiness({ ...base(), members: [{ userId: "a", name: "Ann", roleId: null }] });
    expect(r.next.key).toBe("placed");
    expect(r.kpis).toMatchObject({ placedPeople: 0, totalPeople: 1 });
  });
  it("asks for assessments once people are placed and none has one", () => {
    const r = computeReadiness({ ...base(), members: base().members.slice(0, 2) });
    expect(r.next.key).toBe("assessed");
    expect(r.roles[0]).toMatchObject({ people: 2, assessed: 0, readyPercent: null });
  });
  it("works out who is ready, close and short, and the share ready", () => {
    const r = computeReadiness({ ...base(), assessments: [scored("a", [4, 3]), scored("b", [2, 3])] });
    expect(r.roles[0]).toMatchObject({ people: 2, assessed: 2, ready: 1, gap: 1, readyPercent: 50 });
    expect(r.kpis).toMatchObject({ assessedPeople: 2, placedPeople: 2, readyPercent: 50 });
    expect(r.peopleWithGaps).toBe(1);
  });
  it("names the biggest gap and puts the people with gaps first", () => {
    const r = computeReadiness({ ...base(), assessments: [scored("a", [4, 3]), scored("b", [2, 3])] });
    expect(r.kpis.biggestGap).toEqual({ name: "Quality", shortfall: 1 });
    expect(r.roles[0].persons.map((p) => p.name)).toEqual(["Bo", "Ann"]);
    expect(r.roles[0].competencies[0]).toMatchObject({ name: "Quality", required: 4, assessed: 2, met: 1, average: 3, shortfall: 1 });
  });
  it("uses a manager's override over the scored level", () => {
    const a = scored("a", [2, 3]);
    a.results[0].overrideLevel = 4;
    const r = computeReadiness({ ...base(), assessments: [a] });
    expect(r.roles[0].persons.find((p) => p.userId === "a")?.state).toBe("ready");
  });
  it("treats a competency that could not be assessed as not assessed, not as a gap", () => {
    const r = computeReadiness({ ...base(), assessments: [scored("a", [4, null])] });
    const ann = r.roles[0].persons.find((p) => p.userId === "a")!;
    expect(ann.state).toBe("ready");
    expect(ann.competencies[1].state).toBe("notAssessed");
  });
  it("only counts an assessment for the job the person holds now, and the latest one", () => {
    const old = scored("a", [1, 1], { id: "old", createdAt: "2026-10-01" });
    const other = scored("a", [1, 1], { id: "other", roleId: "r-old" });
    const latest = scored("a", [4, 3], { id: "new", createdAt: "2026-11-15" });
    const r = computeReadiness({ ...base(), assessments: [old, other, latest] });
    expect(r.roles[0].persons.find((p) => p.userId === "a")?.state).toBe("ready");
  });
  it("counts assessments still waiting on someone", () => {
    const wait: ReadinessAssessment = { id: "w", userId: "b", roleId: "r1", status: "assigned", createdAt: "2026-11-11", snapshot: [], results: [] };
    const sub: ReadinessAssessment = { ...wait, id: "s", status: "submitted" };
    const done: ReadinessAssessment = { ...wait, id: "d", status: "scoring_failed" };
    expect(computeReadiness({ ...base(), assessments: [wait, sub, done] }).kpis.waiting).toBe(2);
  });
  it("moves on to development once there are gaps, and is done when every one has a plan", () => {
    const assessments = [scored("a", [4, 3]), scored("b", [2, 3])];
    const everyonePlaced = { ...base(), members: base().members.slice(0, 2), assessments };
    expect(computeReadiness(everyonePlaced).next.key).toBe("development");
    // someone with no job comes first in the sequence
    expect(computeReadiness({ ...base(), assessments }).next.key).toBe("placed");
    const withPlan = computeReadiness({ ...everyonePlaced, plansByUser: { b: 1 } });
    expect(withPlan.steps.find((s) => s.key === "development")?.done).toBe(true);
    expect(withPlan.next.key).toBe("done");
  });
  it("counts development against the people who have gaps, and is done when nobody has one", () => {
    const assessments = [scored("a", [4, 3]), scored("b", [2, 3])];
    const r = computeReadiness({ ...base(), members: base().members.slice(0, 2), assessments, plansByUser: { a: 1, b: 1 } });
    expect(r.steps.find((s) => s.key === "development")).toMatchObject({ current: 1, total: 1, done: true });
    const none = computeReadiness({ ...base(), members: base().members.slice(0, 2), assessments: [scored("a", [4, 3]), scored("b", [4, 3])] });
    expect(none.steps.find((s) => s.key === "development")).toMatchObject({ current: 0, total: 0, done: true });
    expect(none.next.key).toBe("done");
  });
  it("ignores jobs nobody holds", () => {
    const r = computeReadiness({ ...base(), roles: [...base().roles, { id: "r2", title: "Empty", family: "X", grade: 1 }] });
    expect(r.roles.map((x) => x.title)).toEqual(["CSM"]);
  });
});

describe("sample data", () => {
  const s = sampleReadiness();
  it("is a believable, complete picture", () => {
    expect(s.roles.length).toBe(4);
    expect(s.kpis.assessedPeople).toBeGreaterThan(5);
    expect(s.kpis.readyPercent).not.toBeNull();
    expect(s.kpis.biggestGap).not.toBeNull();
    expect(s.kpis.waiting).toBe(2);
    expect(s.peopleWithGaps).toBeGreaterThan(0);
  });
  it("has people in every state, so every colour shows", () => {
    const states = new Set(s.roles.flatMap((r) => r.persons.map((p) => p.state)));
    for (const st of ["ready", "close", "gap", "notAssessed"]) expect(states.has(st as never), st).toBe(true);
  });
});
