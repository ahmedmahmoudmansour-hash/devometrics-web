import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { buildCompanyOverview } from "@/lib/organizations/companyOverview";
import { attentionFlagText } from "@/lib/organizations/attentionText";
import { careerHealthTrend, headcountTrend, flightRiskTrend } from "@/lib/organizations/trends";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import WorkforceDashboard from "@/components/dashboard/WorkforceDashboard";

export const metadata = { title: "Workforce Dashboard — Devometrics" };

export default async function CompanyAnalyticsPage() {
  const t = await getTranslations("companyAnalyticsPage");
  const tAttention = await getTranslations("companyProfilePage");
  const tDim = await getTranslations("competencyDimensions");
  const data = await buildCompanyData();
  if (!data.isOrgAdmin) redirect("/dashboard");

  const rows = data.rows;

  let dashboard = null;
  if (rows.length > 0 && data.organizationId) {
    const memberUserIds = rows.map((r) => r.userId);
    const [overview, careerHealthTrendData, headcountTrendData, flightRiskTrendData] = await Promise.all([
      buildCompanyOverview(data),
      careerHealthTrend(memberUserIds),
      headcountTrend(data.organizationId),
      flightRiskTrend(data.organizationId),
    ]);

    const attentionItems = overview.attention.map((flag) => ({
      text: attentionFlagText(tAttention, tDim, flag),
      href: flag.href,
      severity: flag.severity,
    }));

    dashboard = (
      <WorkforceDashboard
        rows={rows.map((r) => ({
          userId: r.userId,
          name: r.name,
          department: r.department,
          country: r.country,
          careerHealthScore: r.careerHealthScore,
          dimensionLevels: r.dimensionLevels,
        }))}
        hiring={overview.hiring}
        surveys={overview.surveys}
        attentionItems={attentionItems}
        careerHealthTrendData={careerHealthTrendData}
        headcountTrendData={headcountTrendData}
        flightRiskTrendData={flightRiskTrendData}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div className="dashboard-wide-content">
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{t("title")}</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>{t("description")}</p>
        </div>

        <CompanyNavTabs active="analytics" />

        {rows.length === 0 ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 22 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>{t("noTeamMembersYet")}</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 20 }}>{t("dataQualityNote")}</p>
            {dashboard}
          </>
        )}
      </div>
    </div>
  );
}
