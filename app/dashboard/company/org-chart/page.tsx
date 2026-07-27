import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import OrgChartPageClient from "@/components/dashboard/OrgChartPageClient";

export const metadata = { title: "Org Chart — Devometrics" };

export default async function OrgChartPage() {
  const t = await getTranslations("orgChartPage");
  const data = await buildCompanyData();
  if (!data.isOrgAdmin) redirect("/dashboard");

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {t("title")}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 680 }}>
            {t("description")}
          </p>
        </div>

        <CompanyNavTabs active="orgChart" />

        {data.rows.length === 0 ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
              {t("noTeamMembersYet")}
            </p>
          </div>
        ) : (
          <OrgChartPageClient rows={data.rows} />
        )}
      </div>
    </div>
  );
}
