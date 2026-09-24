import Link from "next/link";
import { getTranslations } from "next-intl/server";

type TabKey = "profile" | "employees" | "jobArchitecture" | "hiring" | "orgChart" | "competencies" | "analytics" | "highPotential" | "succession" | "scorecard" | "surveys" | "performanceReviews" | "knowledgeHub" | "exitInterviews" | "permissions" | "compensation" | "leave" | "settings";

// Grouped into 5 clusters instead of one flat row (2026-08 fix) — but even
// grouped, all 18 links stayed visible on every single company page,
// ahead of any real content. 2026-09-24: collapsed to two tiers instead —
// the 5 group labels always show (still exactly one click from any
// section), but only the CURRENT group's own items expand below them, so
// an admin sees ~5 + a handful, not 18, on any given page. Zero client JS:
// which group is "open" is derived from `active` (already known
// server-side), and each group label is itself a real link to that
// group's first tab — clicking "Talent" both navigates AND expands it,
// no separate toggle state to manage. Grouping itself is unchanged, by
// what an admin is actually trying to do, not by when each feature
// shipped: Overview (who's here, the big picture), Structure (how the org
// is shaped), Talent (who's ready for what), Hiring & Growth (bringing
// people in and up to speed), Performance & Feedback (ongoing
// review/listening loops).
const GROUPS: { labelKey: string; tabs: TabKey[] }[] = [
  { labelKey: "groupOverview", tabs: ["profile", "employees", "analytics", "permissions", "compensation", "leave", "settings"] },
  { labelKey: "groupStructure", tabs: ["orgChart", "jobArchitecture", "competencies"] },
  { labelKey: "groupTalent", tabs: ["highPotential", "succession", "scorecard"] },
  { labelKey: "groupHiringGrowth", tabs: ["hiring", "knowledgeHub"] },
  { labelKey: "groupPerformanceFeedback", tabs: ["performanceReviews", "surveys", "exitInterviews"] },
];

export default async function CompanyNavTabs({ active }: { active: TabKey }) {
  const t = await getTranslations("companyNavTabs");
  const hrefByTab: Record<TabKey, string> = {
    profile: "/dashboard/company",
    employees: "/dashboard/company/employees",
    jobArchitecture: "/dashboard/company/job-architecture",
    hiring: "/dashboard/company/hiring",
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
    compensation: "/dashboard/company/compensation",
    leave: "/dashboard/company/leave",
    settings: "/dashboard/company/settings",
  };

  const activeGroup = GROUPS.find((group) => group.tabs.includes(active)) ?? GROUPS[0];

  return (
    <div style={{ marginBottom: 24, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {GROUPS.map((group) => {
          const isActiveGroup = group.labelKey === activeGroup.labelKey;
          return (
            <Link
              key={group.labelKey}
              href={hrefByTab[group.tabs[0]]}
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                textDecoration: "none",
                whiteSpace: "nowrap",
                color: isActiveGroup ? "var(--teal)" : "var(--text-muted)",
              }}
            >
              {t(group.labelKey)}
            </Link>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
        {activeGroup.tabs.map((key) => (
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
  );
}
