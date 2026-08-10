import Link from "next/link";
import { getTranslations } from "next-intl/server";

type TabKey = "profile" | "employees" | "jobArchitecture" | "hiring" | "orgChart" | "competencies" | "analytics" | "highPotential" | "succession" | "scorecard" | "surveys" | "performanceReviews" | "knowledgeHub" | "exitInterviews" | "onboarding" | "permissions";

// Grouped into 5 clusters of 3 instead of one flat row — at 15 items the
// flat version wrapped to 2 lines of equal-weight links with no way to
// scan them (verified against a live screenshot). Mirrors the grouping
// pattern SidebarNav.tsx already uses (uppercase section label above a
// cluster of items) rather than inventing a new convention. Grouping is by
// what an admin is actually trying to do, not by when each feature shipped:
// Overview (who's here, the big picture), Structure (how the org is
// shaped), Talent (who's ready for what), Hiring & Growth (bringing people
// in and up to speed), Performance & Feedback (ongoing review/listening
// loops). Every item is still exactly one click away — this is a visual
// reorganization, not a drill-down menu.
const GROUPS: { labelKey: string; tabs: TabKey[] }[] = [
  { labelKey: "groupOverview", tabs: ["profile", "employees", "analytics", "permissions"] },
  { labelKey: "groupStructure", tabs: ["orgChart", "jobArchitecture", "competencies"] },
  { labelKey: "groupTalent", tabs: ["highPotential", "succession", "scorecard"] },
  { labelKey: "groupHiringGrowth", tabs: ["hiring", "onboarding", "knowledgeHub"] },
  { labelKey: "groupPerformanceFeedback", tabs: ["performanceReviews", "surveys", "exitInterviews"] },
];

export default async function CompanyNavTabs({ active }: { active: TabKey }) {
  const t = await getTranslations("companyNavTabs");
  const hrefByTab: Record<TabKey, string> = {
    profile: "/dashboard/company",
    employees: "/dashboard/company/employees",
    jobArchitecture: "/dashboard/company/job-architecture",
    hiring: "/dashboard/company/hiring",
    onboarding: "/dashboard/company/onboarding",
    orgChart: "/dashboard/company/org-chart",
    competencies: "/dashboard/company/competencies",
    performanceReviews: "/dashboard/company/impact-cycles",
    knowledgeHub: "/dashboard/company/knowledge-hub",
    highPotential: "/dashboard/company/high-potential",
    succession: "/dashboard/company/succession",
    scorecard: "/dashboard/company/scorecard",
    surveys: "/dashboard/company/surveys",
    exitInterviews: "/dashboard/company/exit-interviews",
    analytics: "/dashboard/company/analytics",
    permissions: "/dashboard/company/permissions",
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "16px 28px",
        marginBottom: 24,
        paddingBottom: 14,
        borderBottom: "1px solid var(--border)",
      }}
    >
      {GROUPS.map((group) => (
        <div key={group.labelKey} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <p
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              margin: 0,
            }}
          >
            {t(group.labelKey)}
          </p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {group.tabs.map((key) => (
              <Link
                key={key}
                href={hrefByTab[key]}
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  color: active === key ? "var(--teal)" : "var(--text)",
                }}
              >
                {t(key)}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
