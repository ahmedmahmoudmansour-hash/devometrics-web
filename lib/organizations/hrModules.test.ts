import { describe, expect, it } from "vitest";
import { ALL_COMPANY_FEATURES, COMPANY_TILES, SWITCHABLE_FEATURE_KEYS, isCompanyFeatureKey } from "./companyTiles";
import { HIDDEN_HR_FEATURE_KEYS, hrModulesHidden } from "./hrModules";

describe("HR administration modules are hidden for now, not removed", () => {
  it("is hidden unless NEXT_PUBLIC_SHOW_HR_MODULES=1", () => {
    expect(process.env.NEXT_PUBLIC_SHOW_HR_MODULES).not.toBe("1");
    expect(hrModulesHidden()).toBe(true);
  });
  it("leaves the Time & Pay tile out of what people see", () => {
    expect(COMPANY_TILES.some((t) => t.key === "timePay")).toBe(false);
    const visible = COMPANY_TILES.flatMap((t) => t.features.map((f) => f.key));
    for (const key of HIDDEN_HR_FEATURE_KEYS) expect(visible).not.toContain(key);
  });
  it("keeps talent, learning and appraisal features visible", () => {
    const visible = COMPANY_TILES.flatMap((t) => t.features.map((f) => f.key));
    for (const key of ["roleAssessments", "succession", "knowledgeHub", "performanceReviews", "jobArchitecture", "competencies", "orgChart"]) expect(visible).toContain(key);
  });
  it("keeps the hidden keys valid, so anything already saved about them still works", () => {
    for (const key of HIDDEN_HR_FEATURE_KEYS) {
      expect(isCompanyFeatureKey(key)).toBe(true);
      expect(ALL_COMPANY_FEATURES.map((f) => f.key)).toContain(key);
    }
    expect(SWITCHABLE_FEATURE_KEYS.length).toBeGreaterThan(0);
  });
});
