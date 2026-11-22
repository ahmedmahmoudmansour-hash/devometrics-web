import { describe, expect, it } from "vitest";
import { ALL_COMPANY_FEATURES, COMPANY_TILES, SWITCHABLE_FEATURE_KEYS, type CompanyFeatureKey, type CompanyTileKey } from "@/lib/organizations/companyTiles";

// Walks the admin side of the navigation map (Devometrics-Navigation-Map-v1.xlsx): every company feature is in exactly one group, in the
// group the map says, the groups follow Assess -> Develop -> Decide, and the hidden HR area stays hidden. Nothing is removed.

const EXPECTED: Record<string, CompanyFeatureKey[]> = {
  people: ["profile", "employees", "orgChart"],
  assess: ["readiness", "jobArchitecture", "roleAssessments", "scorecard"],
  develop: ["knowledgeHub"],
  decisions: ["analytics", "performanceReviews", "highPotential", "succession"],
  settings: ["settings", "competencies", "permissions", "features"],
  more: ["hiring", "surveys", "exitInterviews"],
};
const HIDDEN: CompanyFeatureKey[] = ["leave", "attendance", "compensation"];

describe("the admin navigation map", () => {
  it("shows the agreed groups in the agreed order", () => {
    expect(COMPANY_TILES.map((t) => t.key)).toEqual(["people", "assess", "develop", "decisions", "settings", "more"] as CompanyTileKey[]);
  });
  it("puts every feature in the agreed group", () => {
    for (const tile of COMPANY_TILES) expect(tile.features.map((f) => f.key), tile.key).toEqual(EXPECTED[tile.key]);
  });
  it("keeps every feature that existed: each one is in exactly one group", () => {
    const counts = new Map<string, number>();
    for (const f of ALL_COMPANY_FEATURES) counts.set(f.key, (counts.get(f.key) ?? 0) + 1);
    expect(counts.size).toBe(22);
    for (const [key, n] of counts) expect(n, key).toBe(1);
  });
  it("lists every visible feature once, and none of the hidden HR ones", () => {
    const visible = COMPANY_TILES.flatMap((t) => t.features.map((f) => f.key));
    expect(new Set(visible).size).toBe(visible.length);
    for (const key of HIDDEN) expect(visible).not.toContain(key);
    expect(visible.length).toBe(19);
  });
  it("gives every page a distinct address", () => {
    const hrefs = ALL_COMPANY_FEATURES.map((f) => f.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const h of hrefs) expect(h.startsWith("/dashboard/company")).toBe(true);
  });
  it("never lets an admin switch off the pages that keep the workspace reachable", () => {
    for (const key of ["profile", "employees", "settings", "permissions", "features"] as CompanyFeatureKey[]) expect(SWITCHABLE_FEATURE_KEYS).not.toContain(key);
  });
  it("keeps the feature keys that earlier switches were saved under", () => {
    for (const key of ["orgChart", "jobArchitecture", "competencies", "roleAssessments", "highPotential", "succession", "scorecard", "analytics", "hiring", "knowledgeHub", "performanceReviews", "surveys", "exitInterviews"] as CompanyFeatureKey[]) expect(ALL_COMPANY_FEATURES.map((f) => f.key)).toContain(key);
  });
  it("opens the Assess group on Talent readiness and the Settings group on Settings", () => {
    expect(COMPANY_TILES.find((t) => t.key === "assess")?.features[0].key).toBe("readiness");
    expect(COMPANY_TILES.find((t) => t.key === "settings")?.features[0].key).toBe("settings");
  });
});
