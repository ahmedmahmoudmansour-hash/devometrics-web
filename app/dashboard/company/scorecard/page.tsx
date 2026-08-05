import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { computeLearningGrowthMetrics } from "@/lib/companyScorecard/learningGrowth";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import ScorecardKpiQuadrant from "@/components/dashboard/ScorecardKpiQuadrant";
import type { ScorecardKpi, ScorecardPerspective } from "@/lib/supabase/types";

export const metadata = { title: "Company Scorecard — Devometrics" };

const card: React.CSSProperties = {
  background: "var(--navy-mid)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: 22,
  borderTop: "3px solid var(--teal)",
};

export default async function CompanyScorecardPage() {
  const t = await getTranslations("companyScorecardPage");
  const tMetrics = await getTranslations("learningGrowthMetrics");
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) redirect("/dashboard");

  const supabase = await createClient();
  const { data: kpiRows, error } = await supabase
    .from("scorecard_kpis")
    .select("*")
    .eq("organization_id", data.organizationId)
    .order("created_at", { ascending: true })
    .returns<ScorecardKpi[]>();

  const learningGrowth = computeLearningGrowthMetrics(data, tMetrics);

  const byPerspective = (p: ScorecardPerspective) => (kpiRows ?? []).filter((k) => k.perspective === p);

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div className="dashboard-wide-content">
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

        <CompanyNavTabs active="scorecard" />

        {error ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", padding: 28, borderRadius: 16 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
              {t.rich("migrationNotEnabled", {
                code: (chunks) => <code style={{ color: "var(--teal)" }}>{chunks}</code>,
              })}
            </p>
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
          <div style={card}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
              {t("learningGrowth")}
            </h2>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>
              {t("learningGrowthSubtitle")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {learningGrowth.map((m) => (
                <div key={m.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 600 }}>{m.label}</span>
                    <span className="mono" style={{ fontSize: 15, fontWeight: 800, color: "var(--teal)" }}>{m.value}</span>
                  </div>
                  {m.percent !== null && (
                    <div style={{ marginTop: 4, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, m.percent)}%`, height: "100%", background: "var(--teal)" }} />
                    </div>
                  )}
                  <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.4 }}>{m.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <ScorecardKpiQuadrant
            perspective="customer"
            title={t("customer")}
            accentColor="var(--phase2)"
            description={t("customerDescription")}
            kpis={byPerspective("customer")}
          />

          <ScorecardKpiQuadrant
            perspective="process"
            title={t("process")}
            accentColor="var(--amber)"
            description={t("processDescription")}
            kpis={byPerspective("process")}
          />

          <ScorecardKpiQuadrant
            perspective="financial"
            title={t("financial")}
            accentColor="var(--phase3)"
            description={t("financialDescription")}
            kpis={byPerspective("financial")}
          />
        </div>
      </div>
    </div>
  );
}
