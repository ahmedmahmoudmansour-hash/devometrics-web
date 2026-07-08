import Link from "next/link";
import CompetencyRadar from "./CompetencyRadar";
import type { GapAnalysis } from "@/lib/supabase/types";

function formatTimeline(months: number): string {
  if (months < 12) return `~${months} month${months === 1 ? "" : "s"}`;
  const years = Math.round((months / 12) * 2) / 2;
  return `~${years} year${years === 1 ? "" : "s"}`;
}

export default function GapAnalysisSummary({ analysis }: { analysis: GapAnalysis }) {
  const topGaps = [...analysis.competencies].sort((a, b) => b.gapSize - a.gapSize).slice(0, 3);

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "var(--teal)", textTransform: "uppercase" }}>
            {analysis.target_role}
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: "var(--text)" }}>
              {analysis.career_health_score}
            </span>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Career Health Score</span>
          </div>
        </div>
        <Link
          href="/dashboard/gap-analysis"
          style={{
            background: "rgba(0,201,167,0.1)",
            border: "1px solid rgba(0,201,167,0.3)",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--teal)",
            textDecoration: "none",
          }}
        >
          View full analysis
        </Link>
      </div>

      {analysis.role_context_inferred && (
        <div style={{ background: "rgba(240,184,64,0.06)", border: "1px solid rgba(240,184,64,0.2)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--amber)", textTransform: "uppercase", marginBottom: 6 }}>
            No job description provided — responsibilities inferred
          </p>
          {analysis.estimated_timeline_months !== null && (
            <p style={{ fontSize: 14, color: "var(--text)", fontWeight: 600, marginBottom: 4 }}>
              Estimated timeline to reach this role: {formatTimeline(analysis.estimated_timeline_months)}
            </p>
          )}
          {analysis.timeline_rationale && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>{analysis.timeline_rationale}</p>
          )}
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
            A rough estimate based on typical responsibilities for this role, not a real job posting.
          </p>
        </div>
      )}

      <div style={{ maxWidth: 280, margin: "0 auto" }}>
        <CompetencyRadar competencies={analysis.competencies} />
      </div>

      <div style={{ marginTop: 12 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          Top gaps
        </p>
        {topGaps.map((c) => (
          <div key={c.dimension} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0" }}>
            <span style={{ color: "var(--text)" }}>{c.dimension}</span>
            <span style={{ color: "var(--text-muted)" }}>
              {c.currentLevel} → {c.targetLevel}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
