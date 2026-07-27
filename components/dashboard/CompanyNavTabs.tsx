import Link from "next/link";
import { getTranslations } from "next-intl/server";

type TabKey = "profile" | "employees" | "jobArchitecture" | "hiring" | "orgChart" | "competencies" | "analytics" | "highPotential" | "succession" | "scorecard" | "surveys" | "performanceReviews" | "knowledgeHub";

export default async function CompanyNavTabs({ active }: { active: TabKey }) {
  const t = await getTranslations("companyNavTabs");
  const tabs: { key: TabKey; label: string; href: string }[] = [
    { key: "profile", label: t("profile"), href: "/dashboard/company" },
    { key: "employees", label: t("employees"), href: "/dashboard/company/employees" },
    { key: "jobArchitecture", label: t("jobArchitecture"), href: "/dashboard/company/job-architecture" },
    { key: "hiring", label: t("hiring"), href: "/dashboard/company/hiring" },
    { key: "orgChart", label: t("orgChart"), href: "/dashboard/company/org-chart" },
    { key: "competencies", label: t("competencies"), href: "/dashboard/company/competencies" },
    { key: "performanceReviews", label: t("performanceReviews"), href: "/dashboard/company/impact-cycles" },
    { key: "knowledgeHub", label: t("knowledgeHub"), href: "/dashboard/company/knowledge-hub" },
    { key: "highPotential", label: t("highPotential"), href: "/dashboard/company/high-potential" },
    { key: "succession", label: t("succession"), href: "/dashboard/company/succession" },
    { key: "scorecard", label: t("scorecard"), href: "/dashboard/company/scorecard" },
    { key: "surveys", label: t("surveys"), href: "/dashboard/company/surveys" },
    { key: "analytics", label: t("analytics"), href: "/dashboard/company/analytics" },
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
