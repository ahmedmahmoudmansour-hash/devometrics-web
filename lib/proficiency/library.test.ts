import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMPETENCY_DIMENSIONS } from "@/lib/gap-analysis/dimensions";
import { PROFICIENCY_LEVELS } from "./levels";
import {
  MAX_LEVEL_INDICATOR_LENGTH,
  cleanLevelIndicators,
  companyRequirementsOnly,
  isCompetencyCategory,
  standardDescriptionKey,
  standardLevelKey,
  standardRequirementsOnly,
} from "./library";

const messages = (lang: string) => JSON.parse(readFileSync(new URL(`../../messages/${lang}.json`, import.meta.url), "utf8"));

describe("standard competency library", () => {
  for (const lang of ["en", "ar"]) {
    it(`has a description and five level indicators for every standard competency (${lang})`, () => {
      const lib = messages(lang).competencyLibrary;
      for (const dim of COMPETENCY_DIMENSIONS) {
        expect(typeof lib[standardDescriptionKey(dim)], `${dim} description`).toBe("string");
        expect(lib[standardDescriptionKey(dim)].length).toBeGreaterThan(10);
        for (const level of PROFICIENCY_LEVELS) {
          const text = lib[standardLevelKey(dim, level)];
          expect(typeof text, `${dim} level ${level}`).toBe("string");
          expect(text.length).toBeLessThanOrEqual(MAX_LEVEL_INDICATOR_LENGTH);
        }
      }
    });
  }

  it("keeps the Arabic different from the English", () => {
    const en = messages("en").competencyLibrary;
    const ar = messages("ar").competencyLibrary;
    for (const dim of COMPETENCY_DIMENSIONS) expect(ar[standardLevelKey(dim, 3)]).not.toBe(en[standardLevelKey(dim, 3)]);
  });
});

describe("cleanLevelIndicators", () => {
  it("keeps levels 1 to 5, trims, and drops blanks", () => {
    expect(cleanLevelIndicators({ 1: "  Follows steps ", 2: "", 3: "Works alone", 6: "nope", x: "no" })).toEqual({ "1": "Follows steps", "3": "Works alone" });
  });
  it("caps long text", () => {
    expect(cleanLevelIndicators({ 1: "x".repeat(900) })["1"].length).toBe(MAX_LEVEL_INDICATOR_LENGTH);
  });
  it("copes with bad input", () => {
    expect(cleanLevelIndicators(null)).toEqual({});
    expect(cleanLevelIndicators("text")).toEqual({});
    expect(cleanLevelIndicators(["a"])).toEqual({});
    expect(cleanLevelIndicators({ 1: 5 })).toEqual({});
  });
});

describe("requirement rows", () => {
  const rows = [
    { dimension: "Communication", competency_id: null, target_level: 70 },
    { dimension: null, competency_id: "c-1", target_level: 80 },
    { dimension: "Not A Dimension", competency_id: null, target_level: 10 },
    { dimension: null, competency_id: null, target_level: 10 },
  ];
  it("standard-only keeps just the eight dimensions", () => {
    expect(standardRequirementsOnly(rows)).toHaveLength(1);
    expect(standardRequirementsOnly(null)).toEqual([]);
  });
  it("company-only keeps just rows that point at a company competency", () => {
    expect(companyRequirementsOnly(rows).map((r) => r.competency_id)).toEqual(["c-1"]);
  });
});

describe("categories", () => {
  it("accepts only the three", () => {
    expect(isCompetencyCategory("technical")).toBe(true);
    expect(isCompetencyCategory("other")).toBe(false);
    expect(isCompetencyCategory(undefined)).toBe(false);
  });
});

import { planRequirementChanges } from "./library";

describe("planRequirementChanges", () => {
  const comps = new Map([
    ["active-1", { isActive: true }],
    ["active-2", { isActive: true }],
    ["retired-1", { isActive: false }],
  ]);

  it("writes standard and company levels and removes what is no longer required", () => {
    const plan = planRequirementChanges({
      requested: [
        { dimension: "Communication", targetLevel: 80 },
        { dimension: "Leadership", targetLevel: 0 },
        { competencyId: "active-1", targetLevel: 65 },
        { competencyId: "active-2", targetLevel: 0 },
      ],
      existingCompetencyIds: ["active-2"],
      competencies: comps,
    });
    expect([...plan.standard]).toEqual([["Communication", 80]]);
    expect([...plan.company]).toEqual([["active-1", 65]]);
    expect(plan.removeDimensions).not.toContain("Communication");
    expect(plan.removeDimensions).toContain("Leadership");
    expect(plan.removeCompetencyIds).toEqual(["active-2"]);
    expect(plan.rejected).toEqual([]);
  });

  it("refuses a competency from another company", () => {
    const plan = planRequirementChanges({ requested: [{ competencyId: "someone-elses", targetLevel: 70 }], existingCompetencyIds: [], competencies: comps });
    expect(plan.company.size).toBe(0);
    expect(plan.rejected).toEqual(["someone-elses"]);
  });

  it("does not add a retired competency to a role, but lets a role that has one keep and edit it", () => {
    const added = planRequirementChanges({ requested: [{ competencyId: "retired-1", targetLevel: 70 }], existingCompetencyIds: [], competencies: comps });
    expect(added.company.size).toBe(0);
    expect(added.rejected).toEqual(["retired-1"]);
    const kept = planRequirementChanges({ requested: [{ competencyId: "retired-1", targetLevel: 55 }], existingCompetencyIds: ["retired-1"], competencies: comps });
    expect([...kept.company]).toEqual([["retired-1", 55]]);
    expect(kept.rejected).toEqual([]);
  });

  it("ignores unknown dimensions and clamps levels", () => {
    const plan = planRequirementChanges({
      requested: [{ dimension: "Made Up", targetLevel: 50 }, { dimension: "Communication", targetLevel: 250 }, { dimension: "Leadership", targetLevel: Number.NaN }],
      existingCompetencyIds: [],
      competencies: comps,
    });
    expect([...plan.standard]).toEqual([["Communication", 100]]);
  });

  it("clears everything when nothing is required", () => {
    const plan = planRequirementChanges({ requested: [], existingCompetencyIds: ["active-1"], competencies: comps });
    expect(plan.standard.size + plan.company.size).toBe(0);
    expect(plan.removeCompetencyIds).toEqual(["active-1"]);
    expect(plan.removeDimensions).toHaveLength(8);
  });
});
