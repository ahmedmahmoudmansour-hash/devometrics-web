import { describe, expect, it } from "vitest";
import { JOB_BANK } from "./index";
import { proficiencyLevel } from "@/lib/proficiency/levels";
import { planImport, requirementRows, type Existing } from "./plan";

const none: Existing = { familyNames: [], competencyNames: [], rolesByFamily: {} };
const hr = JOB_BANK.find((f) => f.key === "hr")!;

describe("planImport", () => {
  it("creates the family, the needed competencies and the chosen roles on an empty company", () => {
    const p = planImport(JOB_BANK, [{ familyKey: "hr", roleKeys: ["hr.coordinator"] }], none);
    expect(p.familiesToCreate.map((f) => f.key)).toEqual(["hr"]);
    expect(p.rolesToCreate.map((r) => r.role.key)).toEqual(["hr.coordinator"]);
    // only the competencies the chosen role needs, not the whole family
    expect(p.competenciesToCreate.map((c) => c.key).sort()).toEqual(Object.keys(hr.roles[0].technical).sort());
    expect(p.competenciesToCreate.length).toBeLessThan(hr.competencies.length + 1);
  });

  it("creates the union of competencies across several roles, each once", () => {
    const p = planImport(JOB_BANK, [{ familyKey: "hr", roleKeys: hr.roles.map((r) => r.key) }], none);
    expect(p.rolesToCreate.length).toBe(hr.roles.length);
    expect(new Set(p.competenciesToCreate.map((c) => c.key)).size).toBe(p.competenciesToCreate.length);
    expect(p.competenciesToCreate.length).toBe(hr.competencies.length);
  });

  it("is idempotent: what the company already has is kept and never recreated", () => {
    const existing: Existing = {
      familyNames: ["human resources"],
      competencyNames: hr.competencies.map((c) => c.name.toUpperCase()),
      rolesByFamily: { "human resources": hr.roles.map((r) => r.title) },
    };
    const p = planImport(JOB_BANK, [{ familyKey: "hr", roleKeys: hr.roles.map((r) => r.key) }], existing);
    expect(p.familiesToCreate).toEqual([]);
    expect(p.competenciesToCreate).toEqual([]);
    expect(p.rolesToCreate).toEqual([]);
    expect(p.familiesExisting).toEqual(["Human Resources"]);
    expect(p.rolesExisting.length).toBe(hr.roles.length);
  });

  it("adds only the missing roles to an existing family", () => {
    const existing: Existing = { familyNames: ["Human Resources"], competencyNames: [], rolesByFamily: { "human resources": ["HR Coordinator"] } };
    const p = planImport(JOB_BANK, [{ familyKey: "hr", roleKeys: ["hr.coordinator", "hr.generalist"] }], existing);
    expect(p.familiesToCreate).toEqual([]);
    expect(p.rolesToCreate.map((r) => r.role.key)).toEqual(["hr.generalist"]);
    expect(p.rolesExisting).toEqual(["HR Coordinator"]);
  });

  it("does not create a competency the company already named, and reuses it", () => {
    const existing: Existing = { ...none, competencyNames: ["recruitment and selection"] };
    const p = planImport(JOB_BANK, [{ familyKey: "hr", roleKeys: ["hr.talent_acquisition"] }], existing);
    expect(p.competenciesToCreate.map((c) => c.key)).not.toContain("hr.recruitment");
    expect(p.competenciesExisting).toContain("Recruitment and Selection");
  });

  it("reports unknown keys and ignores a family with no roles chosen", () => {
    const p = planImport(JOB_BANK, [{ familyKey: "nope", roleKeys: ["x"] }, { familyKey: "hr", roleKeys: [] }, { familyKey: "hr", roleKeys: ["hr.zzz"] }], none);
    expect(p.unknown).toEqual(["nope", "hr.zzz"]);
    expect(p.familiesToCreate).toEqual([]);
    expect(p.rolesToCreate).toEqual([]);
  });

  it("handles a role selected twice and two families together", () => {
    const p = planImport(JOB_BANK, [{ familyKey: "hr", roleKeys: ["hr.coordinator", "hr.coordinator"] }, { familyKey: "it", roleKeys: ["it.developer"] }], none);
    expect(p.rolesToCreate.map((r) => r.role.key)).toEqual(["hr.coordinator", "it.developer"]);
    expect(p.familiesToCreate.map((f) => f.key)).toEqual(["hr", "it"]);
  });
});

describe("requirementRows", () => {
  it("stores the middle of each level's band, for company and standard competencies", () => {
    const role = hr.roles.find((r) => r.key === "hr.generalist")!;
    const ids = new Map(hr.competencies.map((c) => [c.key, `id-${c.key}`]));
    const rows = requirementRows(role, ids, hr.competencies.map((c) => c.key));
    const recruit = rows.find((r) => r.competencyId === "id-hr.recruitment");
    expect(proficiencyLevel(recruit?.targetLevel)).toBe(2);
    // every stored target reads back as exactly the level the bank named
    for (const [key, level] of Object.entries(role.technical)) {
      expect(proficiencyLevel(rows.find((r) => r.competencyId === `id-${key}`)?.targetLevel)).toBe(level);
    }
    for (const [dim, level] of Object.entries(role.standard)) {
      expect(proficiencyLevel(rows.find((r) => r.dimension === dim)?.targetLevel)).toBe(level);
    }
    expect(rows.length).toBe(Object.keys(role.technical).length + Object.keys(role.standard).length);
  });

  it("skips a competency that has no id (for example one that could not be created)", () => {
    const role = hr.roles[0];
    const rows = requirementRows(role, new Map(), hr.competencies.map((c) => c.key));
    expect(rows.every((r) => r.dimension)).toBe(true);
  });
});
