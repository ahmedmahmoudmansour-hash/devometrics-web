import { describe, expect, it } from "vitest";
import { buildLadder, type LadderRoleInput } from "./ladder";

const fam = [
  { id: "f1", name: "Sales" },
  { id: "f2", name: "Customer Service" },
  { id: "f3", name: "Empty family" },
];
const role = (id: string, familyId: string, title: string, grade: number, level = "", track: "ic" | "management" = "ic"): LadderRoleInput => ({ id, familyId, title, level, grade, track });

describe("career ladder", () => {
  const roles = [
    role("a", "f2", "Agent", 2, "Entry"),
    role("b", "f2", "Senior Agent", 4, "Senior"),
    role("c", "f2", "Manager", 6, "Manager", "management"),
    role("d", "f1", "Rep", 2, "Entry"),
    role("e", "f1", "Account Executive", 4, "Mid"),
  ];
  const l = buildLadder(fam, roles, { a: 5, b: 2, c: 1, d: 3, e: 0 }, 14);

  it("lists only families that have roles, by name", () => {
    expect(l.families.map((f) => f.name)).toEqual(["Customer Service", "Sales"]);
  });
  it("runs the grades from the highest to the lowest, including steps nobody has", () => {
    expect(l.grades.map((g) => g.grade)).toEqual([6, 5, 4, 3, 2]);
    expect(l.grades.find((g) => g.grade === 5)).toMatchObject({ roles: 0, people: 0 });
    expect(l.grades.find((g) => g.grade === 3)).toMatchObject({ roles: 0, people: 0 });
  });
  it("counts people and roles at each grade", () => {
    expect(l.grades.find((g) => g.grade === 2)).toMatchObject({ roles: 2, people: 8 });
    expect(l.grades.find((g) => g.grade === 4)).toMatchObject({ roles: 2, people: 2 });
    expect(l.maxPeopleInAGrade).toBe(8);
  });
  it("puts each role in its family column and grade row", () => {
    expect(l.cells.f2[6].map((r) => r.title)).toEqual(["Manager"]);
    expect(l.cells.f1[4].map((r) => [r.title, r.people])).toEqual([["Account Executive", 0]]);
    expect(l.cells.f1[6]).toBeUndefined();
  });
  it("names each grade by its most-used level wording", () => {
    expect(l.grades.find((g) => g.grade === 2)?.label).toBe("Entry");
    expect(l.grades.find((g) => g.grade === 5)?.label).toBe("");
  });
  it("shows who is placed and who is not", () => {
    expect(l.placedPeople).toBe(11);
    expect(l.unplacedPeople).toBe(3);
  });
  it("never reports a negative number of unplaced people", () => {
    expect(buildLadder(fam, roles, { a: 50 }, 3).unplacedPeople).toBe(0);
  });
  it("orders roles in a cell by headcount, then title", () => {
    const x = buildLadder(fam, [role("p", "f1", "Zed", 3), role("q", "f1", "Amy", 3), role("r", "f1", "Bob", 3)], { p: 2, q: 0, r: 0 }, 2);
    expect(x.cells.f1[3].map((r) => r.title)).toEqual(["Zed", "Amy", "Bob"]);
  });
  it("copes with no roles at all", () => {
    expect(buildLadder(fam, [], {}, 4)).toMatchObject({ families: [], grades: [], placedPeople: 0, unplacedPeople: 4, maxPeopleInAGrade: 0 });
  });
  it("ignores junk people counts", () => {
    const x = buildLadder(fam, [role("p", "f1", "Zed", 3)], { p: -4 }, 0);
    expect(x.cells.f1[3][0].people).toBe(0);
  });
});
