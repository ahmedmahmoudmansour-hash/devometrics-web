import Link from "next/link";
import { redirect } from "next/navigation";
import { buildScorecard } from "@/lib/scorecard/aggregate";
import ScoreTrendChart from "@/components/dashboard/ScoreTrendChart";
import Mascot from "@/components/Mascot";

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  const positive = delta > 0;
  const flat = delta === 0;
  const color = flat ? "var(--text-muted)" : positive ? "var(--teal)" : "#f87171";
  const sign = positive ? "+" : "";
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color }}>
      {sign}
      {delta} vs. last time
    </span>
  );
}

export default async function ScorecardPage() {
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
            ← Back to progress
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            Your Scorecard
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            How your own numbers have moved over time — not a comparison to other people.
          </p>
        </div>

        {!data.hasAnyData ? (
          <div style={{ ...cardStyle, textAlign: "center" }}>
            <Mascot size={72} className="float" />
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 12 }}>
              Nothing to show yet — run a Gap Analysis, take an assessment, or check your resume
              first, then come back here to see your progress build up over time.
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
              This page benchmarks you against <strong style={{ color: "var(--text)" }}>your own history</strong>,
              not other users or the market. Our pilot cohort isn&apos;t large enough yet for a peer
              percentile to mean anything real — that&apos;s a &quot;not yet,&quot; not a &quot;never.&quot;
            </div>

            {data.careerHealthHistory.length > 0 && (
              <div style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Career Health Score</h2>
                  <DeltaBadge delta={data.careerHealthDelta} />
                </div>
                <p style={{ fontSize: 32, fontWeight: 800, color: "var(--teal)", marginBottom: 8 }}>
                  {data.careerHealthHistory[data.careerHealthHistory.length - 1].score}
                  <span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 400 }}>/100</span>
                </p>
                <ScoreTrendChart points={data.careerHealthHistory} />
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                  Based on {data.careerHealthHistory.length} Gap Analysis run{data.careerHealthHistory.length === 1 ? "" : "s"}.
                </p>
              </div>
            )}

            {data.dimensionMovement.length > 0 && (
              <div style={cardStyle}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>
                  Movement by competency
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.dimensionMovement.map((d) => (
                    <div key={d.dimension} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                      <span style={{ color: "var(--text)" }}>{d.dimension}</span>
                      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ color: "var(--text-muted)" }}>{d.current}/100</span>
                        {d.delta !== null && <DeltaBadge delta={d.delta} />}
                      </span>
                    </div>
                  ))}
                </div>
                {data.dimensionMovement.every((d) => d.delta === null) && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>
                    Run another Gap Analysis later to see how each competency moves.
                  </p>
                )}
              </div>
            )}

            {data.assessmentTrends.length > 0 && (
              <div style={cardStyle}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>
                  Assessment history
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.assessmentTrends.map((a) => (
                    <div key={a.slug} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                      <span style={{ color: "var(--text)" }}>{a.name}</span>
                      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ color: "var(--text-muted)" }}>{a.history[a.history.length - 1].score}/100</span>
                        <DeltaBadge delta={a.delta} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.resumeHistory.length > 0 && (
              <div style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Resume Intelligence</h2>
                  <DeltaBadge delta={data.resumeDelta} />
                </div>
                <p style={{ fontSize: 32, fontWeight: 800, color: "var(--teal)", marginBottom: 8 }}>
                  {data.resumeHistory[data.resumeHistory.length - 1].score}
                  <span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 400 }}>/100</span>
                </p>
                <ScoreTrendChart points={data.resumeHistory} />
              </div>
            )}

            {data.milestonesTotal > 0 && (
              <div style={cardStyle}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
                  Plan execution
                </h2>
                <p style={{ fontSize: 32, fontWeight: 800, color: "var(--text)" }}>
                  {data.milestonesDone}
                  <span style={{ fontSize: 16, color: "var(--text-muted)", fontWeight: 400 }}>/{data.milestonesTotal} milestones done</span>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
