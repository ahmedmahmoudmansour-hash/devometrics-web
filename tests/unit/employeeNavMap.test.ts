import { describe, expect, it } from "vitest";
import { EMPLOYEE_SECTIONS, SECTION_ORDER, buildEmployeeMenu, employeeReachableHrefs, isMainItemActive, sectionForPath, sectionTabs, type EmployeeNavFlags } from "@/components/dashboard/employeeNav";

// Walks the navigation map (Devometrics-Navigation-Map-v1.xlsx) for the employee side: every feature that exists today must stay
// reachable from the menu structure (Home, the main items, the tabs inside each section, or More), by whoever is allowed to use it.
// Nothing is deleted by the simplification; this proves nothing was hidden by accident.

const none: EmployeeNavFlags = { hasDirectReports: false, canSeeImpactCycle: false, hasOrgMembership: false, hasDirectoryEnabled: false, restrictedFeatures: [] };
const everything: EmployeeNavFlags = { hasDirectReports: true, canSeeImpactCycle: true, hasOrgMembership: true, hasDirectoryEnabled: true, restrictedFeatures: [] };

// Every employee-facing page in the map, with the condition under which a person should be able to reach it.
const FEATURES: { href: string; when: (f: EmployeeNavFlags) => boolean; restrictedBy?: string }[] = [
  { href: "/dashboard", when: () => true },
  { href: "/dashboard/assessments", when: () => true },
  { href: "/dashboard/role-assessment", when: (f) => f.hasOrgMembership },
  { href: "/dashboard/scorecard", when: () => true },
  { href: "/dashboard/gap-analysis", when: () => true },
  { href: "/dashboard/discovery", when: () => true },
  { href: "/dashboard/resume", when: () => true, restrictedBy: "resume_intelligence" },
  { href: "/dashboard/plans", when: () => true },
  { href: "/dashboard/career-paths", when: () => true, restrictedBy: "career_development" },
  { href: "/dashboard/journey", when: () => true },
  { href: "/dashboard/job-applications", when: () => true },
  { href: "/dashboard/knowledge-hub", when: (f) => f.hasOrgMembership, restrictedBy: "knowledge_hub" },
  { href: "/dashboard/coach", when: () => true, restrictedBy: "ai_coaching" },
  { href: "/dashboard/roleplay", when: () => true, restrictedBy: "roleplay" },
  { href: "/dashboard/tasks", when: () => true },
  { href: "/dashboard/notes", when: () => true },
  { href: "/dashboard/accountability", when: () => true },
  { href: "/dashboard/my-file", when: (f) => f.hasOrgMembership },
  { href: "/dashboard/certifications", when: () => true },
  { href: "/dashboard/profile", when: () => true },
  { href: "/dashboard/directory", when: (f) => f.hasOrgMembership && f.hasDirectoryEnabled },
  { href: "/dashboard/impact-cycle", when: (f) => f.hasOrgMembership && f.canSeeImpactCycle, restrictedBy: "performance_review" },
  { href: "/dashboard/my-team", when: (f) => f.hasDirectReports },
];

const permutations: EmployeeNavFlags[] = [];
for (const hasDirectReports of [false, true])
  for (const canSeeImpactCycle of [false, true])
    for (const hasOrgMembership of [false, true])
      for (const hasDirectoryEnabled of [false, true]) permutations.push({ hasDirectReports, canSeeImpactCycle, hasOrgMembership, hasDirectoryEnabled, restrictedFeatures: [] });

describe("the employee menu", () => {
  it("has exactly the agreed main items, in order, plus My Team only for managers", () => {
    expect(buildEmployeeMenu(none).main.map((m) => m.labelKey)).toEqual(["myAssessments", "myDevelopment", "aiCoach", "tasksCalendar", "myProfile"]);
    expect(buildEmployeeMenu(everything).main.map((m) => m.labelKey)).toEqual(["myAssessments", "myDevelopment", "aiCoach", "tasksCalendar", "myProfile", "myTeam"]);
  });
  it("never has more than seven main items, however it is configured", () => {
    for (const f of permutations) expect(buildEmployeeMenu(f).main.length).toBeLessThanOrEqual(7);
  });
  it("has no duplicate destinations in the main menu or in More", () => {
    for (const f of permutations) {
      const { main, more } = buildEmployeeMenu(f);
      expect(new Set(main.map((m) => m.href)).size).toBe(main.length);
      expect(new Set(more.map((m) => m.href)).size).toBe(more.length);
    }
  });
});

describe("walking the navigation map", () => {
  it("every feature is reachable by whoever may use it, for every combination of flags", () => {
    for (const f of permutations) {
      const reachable = new Set(employeeReachableHrefs(f));
      for (const feature of FEATURES) if (feature.when(f)) expect(reachable.has(feature.href), `${feature.href} for ${JSON.stringify(f)}`).toBe(true);
    }
  });
  it("nothing is offered to someone who may not use it", () => {
    for (const f of permutations) {
      const reachable = new Set(employeeReachableHrefs(f));
      for (const feature of FEATURES) if (!feature.when(f)) expect(reachable.has(feature.href), `${feature.href} for ${JSON.stringify(f)}`).toBe(false);
    }
  });
  it("a company switching a feature off removes it everywhere it appears (menu, tabs, More)", () => {
    for (const feature of FEATURES.filter((x) => x.restrictedBy)) {
      const f = { ...everything, restrictedFeatures: [feature.restrictedBy as string] };
      expect(employeeReachableHrefs(f), feature.href).not.toContain(feature.href);
    }
  });
  it("restricting one feature never hides an unrelated one", () => {
    const f = { ...everything, restrictedFeatures: ["roleplay"] };
    const reachable = new Set(employeeReachableHrefs(f));
    for (const feature of FEATURES.filter((x) => x.restrictedBy !== "roleplay")) expect(reachable.has(feature.href), feature.href).toBe(true);
  });
  it("the hidden HR modules stay hidden, and nothing was added for them", () => {
    expect(employeeReachableHrefs(everything)).not.toContain("/dashboard/leave");
  });
  it("two clicks at most: every reachable page is the Home page, a main item, a tab of a section, or in More", () => {
    const { main, more } = buildEmployeeMenu(everything);
    const tabs = SECTION_ORDER.flatMap((k) => sectionTabs(k, everything).map((t) => t.href));
    for (const href of employeeReachableHrefs(everything)) expect(href === "/dashboard" || main.some((m) => m.href === href) || tabs.includes(href) || more.some((m) => m.href === href), href).toBe(true);
  });
});

describe("sections and tabs", () => {
  it("each tab page belongs to exactly one section", () => {
    const seen = new Map<string, string>();
    for (const key of SECTION_ORDER)
      for (const tab of EMPLOYEE_SECTIONS[key].tabs) {
        expect(seen.has(tab.href), `${tab.href} is in two sections`).toBe(false);
        seen.set(tab.href, key);
      }
  });
  it("finds the section for a page, including pages reached from a list", () => {
    expect(sectionForPath("/dashboard/scorecard")).toBe("assessments");
    expect(sectionForPath("/dashboard/knowledge-check/abc")).toBe("assessments");
    expect(sectionForPath("/dashboard/role-assessment/abc")).toBe("assessments");
    expect(sectionForPath("/dashboard/gap-analysis")).toBe("development");
    expect(sectionForPath("/dashboard/roleplay")).toBe("coach");
    expect(sectionForPath("/dashboard/certifications")).toBe("profile");
    expect(sectionForPath("/dashboard")).toBeNull();
    expect(sectionForPath("/dashboard/tasks")).toBeNull();
    expect(sectionForPath("/dashboard/company/employees")).toBeNull();
  });
  it("highlights the right main item on every page", () => {
    const { main } = buildEmployeeMenu(everything);
    const active = (path: string) => main.filter((m) => isMainItemActive(m, path)).map((m) => m.labelKey);
    expect(active("/dashboard/scorecard")).toEqual(["myAssessments"]);
    expect(active("/dashboard/career-paths")).toEqual(["myDevelopment"]);
    expect(active("/dashboard/tasks")).toEqual(["tasksCalendar"]);
    expect(active("/dashboard/my-team/role-assessments")).toEqual(["myTeam"]);
    expect(active("/dashboard/notes")).toEqual([]); // a More page: the menu does not pretend otherwise
  });
  it("shows a company member their personal file, and anyone else their account page, behind My Profile", () => {
    expect(buildEmployeeMenu(everything).main.find((m) => m.labelKey === "myProfile")?.href).toBe("/dashboard/my-file");
    expect(buildEmployeeMenu(none).main.find((m) => m.labelKey === "myProfile")?.href).toBe("/dashboard/profile");
  });
  it("drops a tab row that would have a single tab", () => {
    // Outside a company My Assessments still has Assessments and Scorecard; Coach restricted leaves Practice only.
    expect(sectionTabs("assessments", none).length).toBe(2);
    expect(sectionTabs("coach", { ...none, restrictedFeatures: ["ai_coaching"] }).length).toBe(1);
  });
});
