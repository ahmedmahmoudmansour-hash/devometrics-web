import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { COMPETENCY_DIMENSIONS, dimensionLabel } from "@/lib/gap-analysis/dimensions";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import { DonutChart, HBarChart, NineBoxGrid, NineBoxLegend } from "@/components/dashboard/charts";
import { computeNineBoxPoint } from "@/lib/organizations/nineBox";

export const metadata = { title: "Workforce Analytics — Devometrics" };

const card: React.CSSProperties = {
  background: "var(--navy-mid)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: 22,
};

const cardTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "var(--text)",
  marginBottom: 4,
};

const cardHint: React.CSSProperties = {
  fontSize: 11.5,
  color: "var(--text-muted)",
  lineHeight: 1.5,
  marginBottom: 14,
};

function groupCount<T>(rows: T[], key: (r: T) => string | null, unspecifiedLabel: string): { label: string; value: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = key(r) ?? unspecifiedLabel;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export default async function CompanyAnalyticsPage() {
  const t = await getTranslations("companyAnalyticsPage");
  const tDim = await getTranslations("competencyDimensions");
  const data = await buildCompanyData();
  if (!data.isOrgAdmin) redirect("/dashboard");

  const rows = data.rows;
  const withAnalysis = rows.filter((r) => Object.keys(r.dimensionLevels).length > 0);
  const withAssessment = rows.filter((r) => r.assessmentsCompleted > 0);

  const unspecifiedLabel = t("unspecified");
  const byDepartment = groupCount(rows, (r) => r.department, unspecifiedLabel);
  const byCountry = groupCount(rows, (r) => r.country, unspecifiedLabel);

  // Avg career health per department (only members with a score)
  const healthByDept = byDepartment
    .map((d) => {
      const members = rows.filter((r) => (r.department ?? unspecifiedLabel) === d.label && r.careerHealthScore !== null);
      if (members.length === 0) return null;
      return {
        label: d.label,
        value: Math.round(members.reduce((a, r) => a + (r.careerHealthScore ?? 0), 0) / members.length),
      };
    })
    .filter((d): d is { label: string; value: number } => d !== null);

  // Org-wide dimension averages, sorted — top = strengths, bottom = gaps
  const dimensionBars = COMPETENCY_DIMENSIONS.map((dim) => ({
    label: dimensionLabel(tDim, dim),
    value: data.dimensionAverages[dim] ?? 0,
    measured: data.dimensionAverages[dim] !== undefined,
  }))
    .filter((d) => d.measured)
    .sort((a, b) => b.value - a.value);
  const strengths = dimensionBars.slice(0, 3);
  const gaps = [...dimensionBars].reverse().slice(0, 3);

  // 9-box: x = measured capability (avg of all dimensions), y = growth
  // signal (avg of the leadership-oriented dimensions) — same formula the
  // High Potential Pool and individual employee reports use (see
  // lib/organizations/nineBox.ts), so this scatter and those rosters can
  // never quietly disagree about where someone sits.
  const nineBoxPoints = withAnalysis
    .map((r) => {
      const point = computeNineBoxPoint(r.dimensionLevels);
      return point ? { name: r.name, ...point } : null;
    })
    .filter((p): p is { name: string; x: number; y: number } => p !== null);

  const coveragePct = rows.length ? Math.round((withAnalysis.length / rows.length) * 100) : 0;
  const assessmentPct = rows.length ? Math.round((withAssessment.length / rows.length) * 100) : 0;

  // Manager-reported, single-source, optional — same lighter posture as
  // everywhere else performance_rating is used. Only averaged over whoever's
  // actually been rated.
  const rated = rows.filter((r) => r.performanceRating !== null);
  const avgPerformance = rated.length > 0 ? rated.reduce((a, r) => a + (r.performanceRating ?? 0), 0) / rated.length : null;

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {t("title")}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>
            {t("description")}
          </p>
        </div>

        <CompanyNavTabs active="analytics" />

        {rows.length === 0 ? (
          <div style={card}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
              {t("noTeamMembersYet")}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Data quality banner — analytics honesty comes first */}
            <div style={{ ...card, display: "flex", gap: 28, flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>{rows.length}</p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t("activeEmployees")}</p>
              </div>
              <div>
                <p style={{ fontSize: 26, fontWeight: 800, color: coveragePct >= 70 ? "var(--teal)" : "var(--amber)" }}>{coveragePct}%</p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t("gapAnalysisCoverage")}</p>
              </div>
              <div>
                <p style={{ fontSize: 26, fontWeight: 800, color: assessmentPct >= 70 ? "var(--teal)" : "var(--amber)" }}>{assessmentPct}%</p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t("assessmentParticipation")}</p>
              </div>
              {data.companyCareerHealthScore !== null && (
                <div>
                  <p style={{ fontSize: 26, fontWeight: 800, color: "var(--teal)" }}>{data.companyCareerHealthScore}</p>
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t("companyCareerHealth")}</p>
                </div>
              )}
              {avgPerformance !== null && (
                <div>
                  <p style={{ fontSize: 26, fontWeight: 800, color: "var(--teal)" }}>{avgPerformance.toFixed(1)}/5</p>
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                    {t("avgPerformanceRating", { rated: rated.length, total: rows.length })}
                  </p>
                </div>
              )}
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.6, flexBasis: "100%", marginTop: 4 }}>
                {t("dataQualityNote")}
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
              <div style={card}>
                <h2 style={cardTitle}>{t("headcountByDepartment")}</h2>
                <p style={cardHint}>{t("headcountByDepartmentHint")}</p>
                <DonutChart data={byDepartment} />
              </div>
              <div style={card}>
                <h2 style={cardTitle}>{t("headcountByCountry")}</h2>
                <p style={cardHint}>{t("headcountByCountryHint")}</p>
                <DonutChart data={byCountry} />
              </div>
            </div>

            {healthByDept.length > 0 && (
              <div style={card}>
                <h2 style={cardTitle}>{t("careerHealthByDepartment")}</h2>
                <p style={cardHint}>
                  {t("careerHealthByDepartmentHint")}
                </p>
                <HBarChart data={healthByDept} maxValue={100} />
              </div>
            )}

            {dimensionBars.length > 0 && (
              <div style={card}>
                <h2 style={cardTitle}>{t("orgCompetencyProfile")}</h2>
                <p style={cardHint}>
                  {t("orgCompetencyProfileHint")}
                </p>
                <HBarChart
                  data={dimensionBars.map((d) => ({
                    label: d.label,
                    value: d.value,
                    color: strengths.some((s) => s.label === d.label)
                      ? "var(--teal)"
                      : gaps.some((g) => g.label === d.label)
                        ? "var(--amber)"
                        : "var(--phase2)",
                  }))}
                  maxValue={100}
                />
              </div>
            )}

            {nineBoxPoints.length > 0 && (
              <div style={card}>
                <h2 style={cardTitle}>{t("talentGrid")}</h2>
                <p style={cardHint}>
                  {t("talentGridHint")}
                </p>
                <NineBoxGrid
                  points={nineBoxPoints}
                  xLabel={t("measuredCapability")}
                  yLabel={t("leadershipGrowthSignal")}
                />
                <NineBoxLegend />
              </div>
            )}

            <details style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px" }}>
              <summary style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", cursor: "pointer" }}>
                {t("methodologyDisclosure")}
              </summary>
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7, marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                <p>{t("methodologyP1")}</p>
                <p>{t("methodologyP2")}</p>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
