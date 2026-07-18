import Link from "next/link";

type TabKey = "profile" | "employees" | "jobArchitecture" | "orgChart" | "competencies" | "analytics" | "highPotential" | "succession" | "scorecard" | "surveys" | "performanceReviews";

export default function CompanyNavTabs({ active }: { active: TabKey }) {
  const tabs: { key: TabKey; label: string; href: string }[] = [
    { key: "profile", label: "Profile", href: "/dashboard/company" },
    { key: "employees", label: "Employees", href: "/dashboard/company/employees" },
    { key: "jobArchitecture", label: "Job Architecture", href: "/dashboard/company/job-architecture" },
    { key: "orgChart", label: "Org Chart", href: "/dashboard/company/org-chart" },
    { key: "competencies", label: "Competencies", href: "/dashboard/company/competencies" },
    { key: "performanceReviews", label: "Impact Cycles", href: "/dashboard/company/impact-cycles" },
    { key: "highPotential", label: "High Potential", href: "/dashboard/company/high-potential" },
    { key: "succession", label: "Succession", href: "/dashboard/company/succession" },
    { key: "scorecard", label: "Scorecard", href: "/dashboard/company/scorecard" },
    { key: "surveys", label: "Surveys", href: "/dashboard/company/surveys" },
    { key: "analytics", label: "Analytics", href: "/dashboard/company/analytics" },
  ];

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          style={{
            padding: "10px 4px",
            marginBottom: -1,
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
            color: active === tab.key ? "var(--teal)" : "var(--text-muted)",
            borderBottom: active === tab.key ? "2px solid var(--teal)" : "2px solid transparent",
          }}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
