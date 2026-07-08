import Link from "next/link";

type ScoreEntry = {
  label: string;
  score: number | null;
  href: string;
  cta: string;
};

function ScoreCard({ entry }: { entry: ScoreEntry }) {
  const color = entry.score === null ? "var(--text-muted)" : entry.score >= 70 ? "var(--teal)" : entry.score >= 40 ? "#f0b840" : "#f87171";
  return (
    <Link
      href={entry.href}
      style={{
        flex: "1 1 140px",
        display: "block",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "16px 18px",
        textDecoration: "none",
      }}
    >
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>
        {entry.label}
      </p>
      {entry.score === null ? (
        <p style={{ fontSize: 13, color: "var(--teal)", fontWeight: 600 }}>{entry.cta} →</p>
      ) : (
        <p style={{ fontSize: 28, fontWeight: 800, color }}>{entry.score}</p>
      )}
    </Link>
  );
}

export default function CareerHealthOverview({
  gapAnalysisScore,
  assessmentAverage,
  resumeScore,
}: {
  gapAnalysisScore: number | null;
  assessmentAverage: number | null;
  resumeScore: number | null;
}) {
  const scores = [gapAnalysisScore, assessmentAverage, resumeScore].filter((s): s is number => s !== null);
  const composite = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Career Health Overview</h2>
        {composite !== null && (
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Composite: <strong style={{ color: "var(--teal)", fontSize: 16 }}>{composite}</strong>/100
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <ScoreCard
          entry={{ label: "Gap Analysis", score: gapAnalysisScore, href: "/dashboard/gap-analysis", cta: "See your biggest skill gaps" }}
        />
        <ScoreCard
          entry={{ label: "Assessment Center", score: assessmentAverage, href: "/dashboard/assessments", cta: "Find your blind spots" }}
        />
        <ScoreCard
          entry={{ label: "Resume Intelligence", score: resumeScore, href: "/dashboard/resume", cta: "Fix what's costing you interviews" }}
        />
      </div>
      {scores.length > 0 && scores.length < 3 && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 14 }}>
          Composite score is based on {scores.length} of 3 tools so far — complete the others for a fuller picture.
        </p>
      )}
    </div>
  );
}
