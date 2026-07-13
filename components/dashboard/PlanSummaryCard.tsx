import Link from "next/link";
import type { DevelopmentPlan, Milestone } from "@/lib/supabase/types";

// Homepage-appropriate summary — title, progress, and what's next, nothing
// editable. The full interactive plan (check off milestones, add new ones,
// rename, delete, export) now lives at /dashboard/plans/[id]; this card's
// only job is to say "here's where things stand" and hand off to it.
export default function PlanSummaryCard({
  plan,
  milestones,
}: {
  plan: DevelopmentPlan;
  milestones: Milestone[];
}) {
  const total = milestones.length;
  const done = milestones.filter((m) => m.completed).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const next = milestones
    .filter((m) => !m.completed)
    .sort((a, b) => a.position - b.position)[0];

  return (
    <Link
      href={`/dashboard/plans/${plan.id}`}
      style={{
        display: "block",
        background: "var(--navy-mid)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 20,
        textDecoration: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{plan.title}</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {plan.horizon && (
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: "var(--teal)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                background: "rgba(0,201,167,0.1)",
                border: "1px solid rgba(0,201,167,0.3)",
                borderRadius: 100,
                padding: "3px 10px",
                whiteSpace: "nowrap",
              }}
            >
              {plan.horizon}
            </span>
          )}
          <span className="mono" style={{ fontSize: 12.5, color: "var(--teal)", fontWeight: 700 }}>
            {done}/{total}
          </span>
        </div>
      </div>

      <div style={{ marginTop: 10, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--teal)" }} />
      </div>

      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {next ? `Next: ${next.title}` : total === 0 ? "No milestones yet" : "All milestones complete ✓"}
        </span>
        <span style={{ fontSize: 12, color: "var(--teal)", fontWeight: 600, whiteSpace: "nowrap" }}>
          Review &amp; update →
        </span>
      </div>
    </Link>
  );
}
