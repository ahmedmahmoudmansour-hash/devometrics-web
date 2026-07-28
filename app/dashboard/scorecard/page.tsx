import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buildScorecard } from "@/lib/scorecard/aggregate";
import ScoreTrendChart from "@/components/dashboard/ScoreTrendChart";
import Mascot from "@/components/Mascot";
import { dimensionLabel } from "@/lib/gap-analysis/dimensions";
import { resolveAssessmentDisplayName } from "@/lib/assessments/catalog";

function DeltaBadge({ delta, t }: { delta: number | null; t: (key: string, values?: Record<string, string | number>) => string }) {
  if (delta === null) return null;
  const positive = delta > 0;
  const flat = delta === 0;
  const color = flat ? "var(--text-muted)" : positive ? "var(--teal)" : "#f87171";
  const sign = positive ? "+" : "";
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color }}>
      {t("vsLastTime", { value: `${sign}${delta}` })}
    </span>
  );
}

export default async function ScorecardPage() {
  const t = await getTranslations("scorecardPage");
  const tDim = await getTranslations("competencyDimensions");
  const tCatalog = await getTranslations("assessmentCatalog");
  const data = await buildScorecard();
  if (!data) redirect("/login");

  const cardStyle: React.CSSProperties = {
    background: "var(--navy-mid)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 24,
  };

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {t("title")}
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            {t("subtitle")}
          </p>
        </div>

        {!data.hasAnyData ? (
          <div style={{ ...cardStyle, textAlign: "center" }}>
            <Mascot size={72} className="float" />
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 12 }}>
              {t("emptyState")}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div
              style={{
                background: "rgba(240,184,64,0.06)",
                border: "1px solid rgba(240,184,64,0.2)",
                borderRadius: 12,
                padding: "14px 18px",
                fontSize: 12,
                color: "var(--text-muted)",
                lineHeight: 1.6,
              }}
            >
              {t.rich("benchmarkNote", {
                strong: (chunks) => <strong style={{ color: "var(--text)" }}>{chunks}</strong>,
              })}
            </div>

            {data.careerHealthHistory.length > 0 && (
              <div style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{t("careerHealthScore")}</h2>
                  <DeltaBadge delta={data.careerHealthDelta} t={t} />
                </div>
                <p style={{ fontSize: 32, fontWeight: 800, color: "var(--teal)", marginBottom: 8 }}>
                  {data.careerHealthHistory[data.careerHealthHistory.length - 1].score}
                  <span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 400 }}>/100</span>
                </p>
                <ScoreTrendChart points={data.careerHealthHistory} noDataYetLabel={t("noTrendYet")} ariaLabel={t("scoreTrendAriaLabel")} />
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                  {t("basedOnRuns", { count: data.careerHealthHistory.length })}
                </p>
              </div>
            )}

            {data.dimensionMovement.length > 0 && (
              <div style={cardStyle}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>
                  {t("movementByCompetency")}
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.dimensionMovement.map((d) => (
                    <div key={d.dimension} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                      <span style={{ color: "var(--text)" }}>{dimensionLabel(tDim, d.dimension)}</span>
                      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ color: "var(--text-muted)" }}>{d.current}/100</span>
                        {d.delta !== null && <DeltaBadge delta={d.delta} t={t} />}
                      </span>
                    </div>
                  ))}
                </div>
                {data.dimensionMovement.every((d) => d.delta === null) && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>
                    {t("runAnotherGapAnalysis")}
                  </p>
                )}
              </div>
            )}

            {data.assessmentTrends.length > 0 && (
              <div style={cardStyle}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>
                  {t("assessmentHistory")}
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.assessmentTrends.map((a) => (
                    <div key={a.slug} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                      <span style={{ color: "var(--text)" }}>{resolveAssessmentDisplayName(tCatalog, a.slug)}</span>
                      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ color: "var(--text-muted)" }}>{a.history[a.history.length - 1].score}/100</span>
                        <DeltaBadge delta={a.delta} t={t} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.resumeHistory.length > 0 && (
              <div style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{t("resumeIntelligence")}</h2>
                  <DeltaBadge delta={data.resumeDelta} t={t} />
                </div>
                <p style={{ fontSize: 32, fontWeight: 800, color: "var(--teal)", marginBottom: 8 }}>
                  {data.resumeHistory[data.resumeHistory.length - 1].score}
                  <span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 400 }}>/100</span>
                </p>
                <ScoreTrendChart points={data.resumeHistory} noDataYetLabel={t("noTrendYet")} ariaLabel={t("scoreTrendAriaLabel")} />
              </div>
            )}

            {data.milestonesTotal > 0 && (
              <div style={cardStyle}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
                  {t("planExecution")}
                </h2>
                <p style={{ fontSize: 32, fontWeight: 800, color: "var(--text)" }}>
                  {data.milestonesDone}
                  <span style={{ fontSize: 16, color: "var(--text-muted)", fontWeight: 400 }}>{t("milestonesDoneOf", { total: data.milestonesTotal })}</span>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
