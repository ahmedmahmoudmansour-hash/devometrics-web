import Link from "next/link";
import { redirect } from "next/navigation";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { COMPETENCY_DIMENSIONS } from "@/lib/gap-analysis/dimensions";
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

function groupCount<T>(rows: T[], key: (r: T) => string | null): { label: string; value: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = key(r) ?? "Unspecified";
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export default async function CompanyAnalyticsPage() {
  const data = await buildCompanyData();
  if (!data.isOrgAdmin) redirect("/dashboard");

  const rows = data.rows;
  const withAnalysis = rows.filter((r) => Object.keys(r.dimensionLevels).length > 0);
  const withAssessment = rows.filter((r) => r.assessmentsCompleted > 0);

  const byDepartment = groupCount(rows, (r) => r.department);
  const byCountry = groupCount(rows, (r) => r.country);

  // Avg career health per department (only members with a score)
  const healthByDept = byDepartment
    .map((d) => {
      const members = rows.filter((r) => (r.department ?? "Unspecified") === d.label && r.careerHealthScore !== null);
      if (members.length === 0) return null;
      return {
        label: d.label,
        value: Math.round(members.reduce((a, r) => a + (r.careerHealthScore ?? 0), 0) / members.length),
      };
    })
    .filter((d): d is { label: string; value: number } => d !== null);

  // Org-wide dimension averages, sorted — top = strengths, bottom = gaps
  const dimensionBars = COMPETENCY_DIMENSIONS.map((dim) => ({
    label: dim,
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
            ← Back to progress
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            Workforce Analytics
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>
            Your organization&apos;s talent picture, computed live from real assessment and gap-analysis
            data — no survey-of-one guesses.
          </p>
        </div>

        <CompanyNavTabs active="analytics" />

        {rows.length === 0 ? (
          <div style={card}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
              No team members yet — analytics light up as your people join and complete their gap
              analyses and assessments.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Data quality banner — analytics honesty comes first */}
            <div style={{ ...card, display: "flex", gap: 28, flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>{rows.length}</p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Active employees</p>
              </div>
              <div>
                <p style={{ fontSize: 26, fontWeight: 800, color: coveragePct >= 70 ? "var(--teal)" : "var(--amber)" }}>{coveragePct}%</p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Gap Analysis coverage</p>
              </div>
              <div>
                <p style={{ fontSize: 26, fontWeight: 800, color: assessmentPct >= 70 ? "var(--teal)" : "var(--amber)" }}>{assessmentPct}%</p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Assessment participation</p>
              </div>
              {data.companyCareerHealthScore !== null && (
                <div>
                  <p style={{ fontSize: 26, fontWeight: 800, color: "var(--teal)" }}>{data.companyCareerHealthScore}</p>
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Company Career Health</p>
                </div>
              )}
              {avgPerformance !== null && (
                <div>
                  <p style={{ fontSize: 26, fontWeight: 800, color: "var(--teal)" }}>{avgPerformance.toFixed(1)}/5</p>
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                    Avg. performance rating ({rated.length}/{rows.length} rated)
                  </p>
                </div>
              )}
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.6, flexBasis: "100%", marginTop: 4 }}>
                Every chart below reflects only measured data — low coverage means the picture is
                partial, not that the people are. Raising participation is the fastest way to make
                these analytics decision-grade.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
              <div style={card}>
                <h2 style={cardTitle}>Headcount by department</h2>
                <p style={cardHint}>Where your people sit.</p>
                <DonutChart data={byDepartment} />
              </div>
              <div style={card}>
                <h2 style={cardTitle}>Headcount by country</h2>
                <p style={cardHint}>Geographic distribution.</p>
                <DonutChart data={byCountry} />
              </div>
            </div>

            {healthByDept.length > 0 && (
              <div style={card}>
                <h2 style={cardTitle}>Career Health by department</h2>
                <p style={cardHint}>
                  Average Career Health Score of members who&apos;ve run a Gap Analysis, per department.
                </p>
                <HBarChart data={healthByDept} maxValue={100} />
              </div>
            )}

            {dimensionBars.length > 0 && (
              <div style={card}>
                <h2 style={cardTitle}>Organizational competency profile</h2>
                <p style={cardHint}>
                  Team-average level per dimension, strongest first — your top 3 are organizational
                  strengths to build on; the bottom 3 are where targeted development moves the whole
                  company.
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
                <h2 style={cardTitle}>Talent grid (9-box)</h2>
                <p style={cardHint}>
                  The classic succession-planning grid, with honest axes: horizontal is overall
                  measured capability (all dimensions), vertical is leadership growth signal
                  (Leadership, Strategic Thinking, People Management). Top-right are your future
                  leaders; bottom-left needs investment. Hover any dot for the name.
                </p>
                <NineBoxGrid
                  points={nineBoxPoints}
                  xLabel="Measured capability"
                  yLabel="Leadership growth signal"
                />
                <NineBoxLegend />
              </div>
            )}

            <details style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px" }}>
              <summary style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", cursor: "pointer" }}>
                Methodology &amp; responsible use
              </summary>
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7, marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                <p>
                  The 9-box layout follows the performance-and-potential tradition popularized in
                  GE/McKinsey-era succession practice, adapted honestly: this platform measures
                  competency levels, not appraisal ratings, so the axes say what they actually
                  contain. The literature on identifying potential (e.g. Silzer &amp; Church, 2009)
                  emphasizes multi-source, structured evidence over single-rater impressions —
                  which is exactly why these charts draw only on measured assessment and
                  gap-analysis data.
                </p>
                <p>
                  Treat every view as decision support: a person low on the grid with 0 assessments
                  is undermeasured, not underperforming. No demographic attributes are used
                  anywhere in these computations.
                </p>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
