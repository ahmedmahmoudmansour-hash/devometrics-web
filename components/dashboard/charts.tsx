// Lightweight themed SVG charts — deliberately no charting library: the
// bundle stays small, everything inherits the CSS-variable theme (including
// enterprise brand-color overrides), and each chart renders identically in
// light/dark mode. Server-component friendly (no hooks, no handlers).

const TEAL = "var(--teal)";
const AMBER = "var(--amber)";
const MUTED = "var(--text-muted)";
const GRID = "rgba(128,140,160,0.18)";

export function HBarChart({
  data,
  maxValue,
  unit = "",
  height = 26,
  benchmarkLabel,
}: {
  data: { label: string; value: number; color?: string; benchmark?: number }[];
  maxValue?: number;
  unit?: string;
  height?: number;
  // Shown once beneath the chart, only if at least one row has a benchmark
  // — e.g. "— marks the team average". Keeps the marker meaningful without
  // repeating the caption on every row.
  benchmarkLabel?: string;
}) {
  const max = maxValue ?? Math.max(1, ...data.map((d) => d.value));
  const hasBenchmark = data.some((d) => d.benchmark !== undefined);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map((d) => (
        <div key={d.label} style={{ display: "grid", gridTemplateColumns: "130px 1fr 48px", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={d.label}>
            {d.label}
          </span>
          <svg width="100%" height={height} role="img" aria-label={`${d.label}: ${d.value}${unit}${d.benchmark !== undefined ? `, team average ${d.benchmark}${unit}` : ""}`}>
            <rect x="0" y={height / 2 - 6} width="100%" height="12" rx="6" fill={GRID} />
            <rect
              x="0"
              y={height / 2 - 6}
              width={`${Math.max(2, (d.value / max) * 100)}%`}
              height="12"
              rx="6"
              fill={d.color ?? TEAL}
            />
            {d.benchmark !== undefined && (
              <g>
                <line
                  x1={`${Math.min(100, (d.benchmark / max) * 100)}%`}
                  x2={`${Math.min(100, (d.benchmark / max) * 100)}%`}
                  y1={height / 2 - 9}
                  y2={height / 2 + 9}
                  stroke="var(--text)"
                  strokeWidth="2"
                />
                <title>{`Team average: ${d.benchmark}${unit}`}</title>
              </g>
            )}
          </svg>
          <span style={{ fontSize: 12, fontWeight: 700, color: d.color ?? TEAL, textAlign: "right" }}>
            {d.value}
            {unit}
          </span>
        </div>
      ))}
      {hasBenchmark && benchmarkLabel && (
        <p style={{ fontSize: 10.5, color: MUTED, marginTop: 2 }}>
          <span style={{ display: "inline-block", width: 2, height: 10, background: "var(--text)", verticalAlign: "middle", marginRight: 6 }} />
          {benchmarkLabel}
        </p>
      )}
    </div>
  );
}

const DONUT_COLORS = [TEAL, "var(--phase2)", AMBER, "var(--phase3)", "#f87171", "#34d399", "#f472b6", "#a3e635"];

export function DonutChart({
  data,
  size = 150,
}: {
  data: { label: string; value: number }[];
  size?: number;
}) {
  const total = data.reduce((a, b) => a + b.value, 0);
  if (total === 0) return null;
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  // Cumulative start offsets computed immutably (project lint forbids
  // mutating a counter during render) — n is tiny, O(n²) is irrelevant.
  const dashes = data.map((d) => (d.value / total) * circumference);
  const offsets = dashes.map((_, i) => dashes.slice(0, i).reduce((a, b) => a + b, 0));

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <svg width={size} height={size} role="img" aria-label={data.map((d) => `${d.label}: ${d.value}`).join(", ")}>
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {data.map((d, i) => (
            <circle
              key={d.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
              strokeWidth="18"
              strokeDasharray={`${dashes[i]} ${circumference - dashes[i]}`}
              strokeDashoffset={-offsets[i]}
            />
          ))}
        </g>
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--text)">
          {total}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="10" fill={MUTED}>
          total
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.map((d, i) => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "var(--text)" }}>{d.label}</span>
            <span style={{ fontSize: 12, color: MUTED }}>
              {d.value} · {Math.round((d.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// The classic 9-box (capability × growth signal) from the GE/McKinsey
// succession tradition — axes are labeled by what this platform actually
// measures, not the classic "performance/potential" wording, because true
// performance ratings aren't captured here yet and honest axis names beat
// borrowed ones.
// The 9 classic performance/potential zones, generalized to whatever
// "capability-style" x-axis and "growth/readiness-style" y-axis a given
// grid uses (both callers of NineBoxGrid plot different pairs, but both
// are 0-100 measured signals, so the same zone semantics apply honestly
// to either). row/col are 0 = low, 1 = mid, 2 = high.
export const NINE_BOX_ZONES: { row: 0 | 1 | 2; col: 0 | 1 | 2; label: string; needs: string; tone: "teal" | "amber" | "danger" | "muted" }[] = [
  { row: 2, col: 0, label: "High Potential", needs: "Fast-track development and sponsorship — capability is behind, but growth signal is strong.", tone: "amber" },
  { row: 2, col: 1, label: "Future Star", needs: "Accelerated growth plan and visibility — keep them engaged and challenged.", tone: "teal" },
  { row: 2, col: 2, label: "Future Leader", needs: "Succession-ready. Retain deliberately and prepare for the transition.", tone: "teal" },
  { row: 1, col: 0, label: "Rough Diamond", needs: "Structured coaching and foundational skill-building before stretching further.", tone: "amber" },
  { row: 1, col: 1, label: "Core Player", needs: "Steady development and broader exposure — the dependable middle of the org.", tone: "muted" },
  { row: 1, col: 2, label: "Trusted Professional", needs: "Stretch assignments and more visibility so capability keeps compounding.", tone: "teal" },
  { row: 0, col: 0, label: "Needs Attention", needs: "Address directly — closer coaching, a performance plan, or a role that fits better.", tone: "danger" },
  { row: 0, col: 1, label: "Inconsistent", needs: "Closer management and fundamentals — capability is present but growth has stalled.", tone: "amber" },
  { row: 0, col: 2, label: "Plateaued", needs: "New challenges to reignite growth — capable but at risk of disengaging.", tone: "muted" },
];

const ZONE_TONE_COLOR: Record<string, string> = {
  teal: TEAL,
  amber: AMBER,
  danger: "var(--danger)",
  muted: MUTED,
};

const ZONE_TONE_FILL: Record<string, string> = {
  teal: "rgba(0,201,167,0.10)",
  amber: "rgba(240,184,64,0.09)",
  danger: "rgba(248,113,113,0.08)",
  muted: "rgba(128,140,160,0.06)",
};

// A compact reference for what each of the 9 zones means and what it
// calls for — collapsed by default (matches the "Methodology" details
// pattern already used on the Analytics and Succession pages) so it's
// available without permanently taking up space next to every grid.
//
// forceOpen renders the same content as a plain div instead of
// <details>/<summary>: a closed <details> hides its children under print
// in most browsers regardless of the `open` attribute, so anything
// rendered inside a .print-plan export (see globals.css) must use this,
// or the zone guide would be silently missing from the exported PDF.
export function NineBoxLegend({ forceOpen = false }: { forceOpen?: boolean } = {}) {
  const items = (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 10 }}>
      {[...NINE_BOX_ZONES]
        .sort((a, b) => b.row - a.row || a.col - b.col)
        .map((z) => (
          <div key={z.label} style={{ borderLeft: `2px solid ${ZONE_TONE_COLOR[z.tone]}`, paddingLeft: 10 }}>
            <p style={{ fontSize: 11.5, fontWeight: 700, color: ZONE_TONE_COLOR[z.tone] }}>{z.label}</p>
            <p style={{ fontSize: 11, color: MUTED, lineHeight: 1.5, marginTop: 2 }}>{z.needs}</p>
          </div>
        ))}
    </div>
  );

  if (forceOpen) {
    return (
      <div style={{ marginTop: 12 }}>
        <p style={{ fontSize: 11.5, fontWeight: 700, color: MUTED }}>9-box zone guide — what each zone needs</p>
        {items}
      </div>
    );
  }

  return (
    <details style={{ marginTop: 12 }}>
      <summary style={{ fontSize: 11.5, fontWeight: 700, color: MUTED, cursor: "pointer" }}>
        9-box zone guide — what each zone needs
      </summary>
      {items}
    </details>
  );
}

export function NineBoxGrid({
  points,
  xLabel,
  yLabel,
  size = 340,
}: {
  points: { name: string; x: number; y: number }[]; // both 0-100
  xLabel: string;
  yLabel: string;
  size?: number;
}) {
  const pad = 34;
  const plot = size - pad * 2;
  const cell = plot / 3;

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("");

  const zoneAt = (row: number, col: number) => NINE_BOX_ZONES.find((z) => z.row === row && z.col === col)!;

  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Nine-box talent grid" style={{ maxWidth: 420 }}>
      {/* zone shading + short label for all 9 cells */}
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => {
          const zone = zoneAt(row, col);
          const x = pad + col * cell;
          const y = pad + (2 - row) * cell;
          return (
            <g key={`${row}-${col}`}>
              <rect x={x} y={y} width={cell} height={cell} fill={ZONE_TONE_FILL[zone.tone]} />
              <text
                x={x + cell / 2}
                y={y + 13}
                textAnchor="middle"
                fontSize="8"
                fontWeight="700"
                fill={ZONE_TONE_COLOR[zone.tone]}
                style={{ textTransform: "uppercase", letterSpacing: "0.02em" }}
              >
                {zone.label}
              </text>
            </g>
          );
        })
      )}
      {/* grid lines */}
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <line x1={pad + i * cell} y1={pad} x2={pad + i * cell} y2={pad + plot} stroke={GRID} />
          <line x1={pad} y1={pad + i * cell} x2={pad + plot} y2={pad + i * cell} stroke={GRID} />
        </g>
      ))}
      {/* points */}
      {points.map((p) => {
        const px = pad + (Math.max(0, Math.min(100, p.x)) / 100) * plot;
        const py = pad + plot - (Math.max(0, Math.min(100, p.y)) / 100) * plot;
        const col = Math.min(2, Math.floor((Math.max(0, Math.min(100, p.x)) / 100) * 3));
        const row = Math.min(2, Math.floor((Math.max(0, Math.min(100, p.y)) / 100) * 3));
        const zone = zoneAt(row, col);
        return (
          <g key={p.name}>
            <circle cx={px} cy={py} r="11" fill="var(--navy-light)" stroke={TEAL} strokeWidth="1.5" />
            <text x={px} y={py + 3.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--text)">
              {initials(p.name)}
            </text>
            <title>{`${p.name} — ${xLabel.toLowerCase()} ${Math.round(p.x)}, ${yLabel.toLowerCase()} ${Math.round(p.y)} — zone: ${zone.label}`}</title>
          </g>
        );
      })}
      {/* axes */}
      <text x={pad + plot / 2} y={size - 6} textAnchor="middle" fontSize="10" fill={MUTED}>
        {xLabel} →
      </text>
      <text x={12} y={pad + plot / 2} textAnchor="middle" fontSize="10" fill={MUTED} transform={`rotate(-90 12 ${pad + plot / 2})`}>
        {yLabel} →
      </text>
    </svg>
  );
}

export function ScoreBar({ value, color }: { value: number; color?: string }) {
  return (
    <div style={{ height: 8, background: GRID, borderRadius: 4, overflow: "hidden" }}>
      <div
        style={{
          width: `${Math.max(2, Math.min(100, value))}%`,
          height: "100%",
          borderRadius: 4,
          background: color ?? TEAL,
        }}
      />
    </div>
  );
}
