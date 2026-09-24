// Plain constants shared by the company hub tiles, the in-page nav tabs and
// the admin "Tiles & features" switches, so all three always describe the
// exact same taxonomy. Free of "use server" on purpose (client components
// import this).

import type { RestrictableFeature } from "@/lib/organizations/featureAccessConstants";

export type CompanyFeatureKey =
  | "profile"
  | "employees"
  | "orgChart"
  | "jobArchitecture"
  | "competencies"
  | "leave"
  | "attendance"
  | "compensation"
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

export type CompanyTileKey = "people" | "timePay" | "talent" | "hiringGrowth" | "performance" | "settings";

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

export const COMPANY_TILES: { key: CompanyTileKey; features: CompanyFeature[] }[] = [
  {
    key: "people",
    features: [
      { key: "profile", href: "/dashboard/company", locked: true, hubHidden: true },
      { key: "employees", href: "/dashboard/company/employees", locked: true },
      { key: "orgChart", href: "/dashboard/company/org-chart" },
      { key: "jobArchitecture", href: "/dashboard/company/job-architecture", employeeFeature: "job_architecture" },
      { key: "competencies", href: "/dashboard/company/competencies", employeeFeature: "competency_management" },
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
  {
    key: "talent",
    features: [
      { key: "highPotential", href: "/dashboard/company/high-potential" },
      { key: "succession", href: "/dashboard/company/succession" },
      { key: "scorecard", href: "/dashboard/company/scorecard" },
      { key: "analytics", href: "/dashboard/company/analytics" },
    ],
  },
  {
    key: "hiringGrowth",
    features: [
      { key: "hiring", href: "/dashboard/company/hiring" },
      { key: "knowledgeHub", href: "/dashboard/company/knowledge-hub", employeeFeature: "knowledge_hub" },
    ],
  },
  {
    key: "performance",
    features: [
      { key: "performanceReviews", href: "/dashboard/company/impact-cycles", employeeFeature: "performance_review" },
      { key: "surveys", href: "/dashboard/company/surveys" },
      { key: "exitInterviews", href: "/dashboard/company/exit-interviews" },
    ],
  },
  {
    key: "settings",
    features: [
      { key: "settings", href: "/dashboard/company/settings", locked: true },
      { key: "permissions", href: "/dashboard/company/permissions", locked: true },
      { key: "features", href: "/dashboard/company/features", locked: true },
    ],
  },
];

export const ALL_COMPANY_FEATURES: CompanyFeature[] = COMPANY_TILES.flatMap((t) => t.features);
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
