import type { MomentumResult } from "@/lib/momentum/momentum";

export default function CareerMomentumCard({ momentum }: { momentum: MomentumResult }) {
  if (momentum.status === "insufficient_data") {
    return (
      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Career Momentum</h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Not enough history yet — check back in a few days to see your trend.
        </p>
      </div>
    );
  }

  const { deltaPoints, deltaPercent, currentScore, daysSince } = momentum;
  const improving = deltaPoints > 0;
  const flat = deltaPoints === 0;
  const color = improving ? "var(--teal)" : flat ? "var(--text-muted)" : "#f87171";
  const arrow = improving ? "↑" : flat ? "→" : "↓";

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>Career Momentum</h2>
      <p className="mono" style={{ fontSize: 26, fontWeight: 700, color }}>
        {arrow} {Math.abs(deltaPoints)} pt{Math.abs(deltaPoints) === 1 ? "" : "s"}
        <span style={{ fontSize: 15, fontWeight: 600, marginLeft: 8 }}>
          ({deltaPercent >= 0 ? "+" : ""}
          {deltaPercent}%)
        </span>
      </p>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
        Career Health {improving ? "up" : flat ? "flat" : "down"} over the last {daysSince} day{daysSince === 1 ? "" : "s"} — currently {currentScore}/100.
      </p>
    </div>
  );
}
