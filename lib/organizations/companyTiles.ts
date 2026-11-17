// Plain constants shared by the company hub tiles, the in-page nav tabs and
// the admin "Tiles & features" switches, so all three always describe the
// exact same taxonomy. Free of "use server" on purpose (client components
// import this).

import type { RestrictableFeature } from "@/lib/organizations/featureAccessConstants";
import { hrModulesHidden } from "@/lib/organizations/hrModules";

export type CompanyFeatureKey =
  | "profile"
  | "employees"
  | "orgChart"
  | "jobArchitecture"
  | "competencies"
  | "leave"
  | "attendance"
  | "compensation"
  | "roleAssessments"
  | "highPotential"
  | "succession"
  | "scorecard"
  | "analytics"
  | "hiring"
  | "knowledgeHub"
  | "performanceReviews"
  | "surveys"
  | "exitInterviews"
  | "settings"
  | "permissions"
  | "features";

// The groups follow what Devometrics is for: Assess (understand capability against role requirements), Develop (close the gaps) and
// Decide (promotion, succession and other talent decisions), with People and Settings around them and the rarely used modules under
// "More". Time & Pay is the hidden HR area (lib/organizations/hrModules.ts). Switch keys are the FEATURE keys, unchanged, so
// anything an admin already switched off stays switched off.
export type CompanyTileKey = "people" | "assess" | "develop" | "decisions" | "settings" | "more" | "timePay";

export type CompanyFeature = {
  key: CompanyFeatureKey;
  href: string;
  // The admin can never switch these off — they're how the switches
  // themselves (and the workspace) stay reachable.
  locked?: boolean;
  // Skipped on the hub itself (the hub IS this page) but still a nav tab.
  hubHidden?: boolean;
  // When set, switching this feature off also restricts the matching
  // employee-facing module for the whole company, through the existing
  // per-feature restriction gates (not a second permission system).
  employeeFeature?: RestrictableFeature;
};

const ALL_COMPANY_TILES: { key: CompanyTileKey; features: CompanyFeature[] }[] = [
  {
    key: "people",
    features: [
      // The company home (the hub); listed first so People is where "Company" lands.
      { key: "profile", href: "/dashboard/company", locked: true, hubHidden: true },
      { key: "employees", href: "/dashboard/company/employees", locked: true },
      { key: "orgChart", href: "/dashboard/company/org-chart" },
    ],
  },
  {
    key: "assess",
    features: [
      { key: "jobArchitecture", href: "/dashboard/company/job-architecture", employeeFeature: "job_architecture" },
      { key: "roleAssessments", href: "/dashboard/company/role-assessments" },
      { key: "scorecard", href: "/dashboard/company/scorecard" },
    ],
  },
  {
    key: "develop",
    features: [{ key: "knowledgeHub", href: "/dashboard/company/knowledge-hub", employeeFeature: "knowledge_hub" }],
  },
  {
    key: "decisions",
    features: [
      { key: "analytics", href: "/dashboard/company/analytics" },
      { key: "performanceReviews", href: "/dashboard/company/impact-cycles", employeeFeature: "performance_review" },
      { key: "highPotential", href: "/dashboard/company/high-potential" },
      { key: "succession", href: "/dashboard/company/succession" },
    ],
  },
  {
    key: "settings",
    features: [
      { key: "settings", href: "/dashboard/company/settings", locked: true },
      { key: "competencies", href: "/dashboard/company/competencies", employeeFeature: "competency_management" },
      { key: "permissions", href: "/dashboard/company/permissions", locked: true },
      { key: "features", href: "/dashboard/company/features", locked: true },
    ],
  },
  {
    key: "more",
    features: [
      { key: "hiring", href: "/dashboard/company/hiring" },
      { key: "surveys", href: "/dashboard/company/surveys" },
      { key: "exitInterviews", href: "/dashboard/company/exit-interviews" },
    ],
  },
  {
    key: "timePay",
    features: [
      { key: "leave", href: "/dashboard/company/leave" },
      { key: "attendance", href: "/dashboard/company/attendance" },
      { key: "compensation", href: "/dashboard/company/compensation" },
    ],
  },
];

// The hidden HR administration area (see lib/organizations/hrModules.ts) is left out of what people see, but its keys stay
// valid so anything already saved about them keeps working.
export const COMPANY_TILES: { key: CompanyTileKey; features: CompanyFeature[] }[] = hrModulesHidden()
  ? ALL_COMPANY_TILES.filter((tile) => tile.key !== "timePay")
  : ALL_COMPANY_TILES;

export const ALL_COMPANY_FEATURES: CompanyFeature[] = ALL_COMPANY_TILES.flatMap((t) => t.features);
export const COMPANY_FEATURE_KEYS = ALL_COMPANY_FEATURES.map((f) => f.key);

export function isCompanyFeatureKey(v: string): v is CompanyFeatureKey {
  return (COMPANY_FEATURE_KEYS as string[]).includes(v);
}

// Keys an admin is allowed to switch off (everything not locked).
export const SWITCHABLE_FEATURE_KEYS = ALL_COMPANY_FEATURES.filter((f) => !f.locked).map((f) => f.key);

// Which employee-facing modules a set of switched-off company features
// takes away from everyone in the company.
export function restrictedEmployeeFeatures(disabled: Iterable<string>): RestrictableFeature[] {
  const off = new Set(disabled);
  return ALL_COMPANY_FEATURES.filter((f) => f.employeeFeature && off.has(f.key)).map((f) => f.employeeFeature as RestrictableFeature);
}
