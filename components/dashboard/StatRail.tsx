import Link from "next/link";

export type RailStat = {
  label: string;
  value: string;
  href?: string;
  color?: string;
};

// The genuinely "glanceable" counterpart to the detailed sections below —
// one number, one label, done. Uses the same .mono/tabular-nums instrument
// treatment as every other score on the site (globals.css), so this reads
// as part of the same measurement system, not a bolt-on widget style.
// Server-component friendly: no hooks, no handlers.
function Tile({ stat }: { stat: RailStat }) {
  const body = (
    <div
      style={{
        background: "var(--navy-mid)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: "16px 18px",
      }}
    >
      <p
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: 6,
        }}
      >
        {stat.label}
      </p>
      <p className="mono" style={{ fontSize: 22, fontWeight: 800, color: stat.color ?? "var(--text)", letterSpacing: "-0.01em" }}>
        {stat.value}
      </p>
    </div>
  );

  if (!stat.href) return body;
  return (
    <Link href={stat.href} style={{ textDecoration: "none", display: "block" }}>
      {body}
    </Link>
  );
}

export default function StatRail({ stats }: { stats: RailStat[] }) {
  return (
    <div className="dashboard-rail" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {stats.map((s) => (
        <Tile key={s.label} stat={s} />
      ))}
    </div>
  );
}
