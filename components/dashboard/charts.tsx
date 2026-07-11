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
}: {
  data: { label: string; value: number; color?: string }[];
  maxValue?: number;
  unit?: string;
  height?: number;
}) {
  const max = maxValue ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map((d) => (
        <div key={d.label} style={{ display: "grid", gridTemplateColumns: "130px 1fr 48px", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={d.label}>
            {d.label}
          </span>
          <svg width="100%" height={height} role="img" aria-label={`${d.label}: ${d.value}${unit}`}>
            <rect x="0" y={height / 2 - 6} width="100%" height="12" rx="6" fill={GRID} />
            <rect
              x="0"
              y={height / 2 - 6}
              width={`${Math.max(2, (d.value / max) * 100)}%`}
              height="12"
              rx="6"
              fill={d.color ?? TEAL}
            />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 700, color: d.color ?? TEAL, textAlign: "right" }}>
            {d.value}
            {unit}
          </span>
        </div>
      ))}
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

  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Nine-box talent grid" style={{ maxWidth: 420 }}>
      {/* zone shading: top-right = stars, bottom-left = develop */}
      <rect x={pad + 2 * cell} y={pad} width={cell} height={cell} fill="rgba(0,201,167,0.12)" />
      <rect x={pad} y={pad + 2 * cell} width={cell} height={cell} fill="rgba(240,184,64,0.10)" />
      {/* grid */}
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <line x1={pad + i * cell} y1={pad} x2={pad + i * cell} y2={pad + plot} stroke={GRID} />
          <line x1={pad} y1={pad + i * cell} x2={pad + plot} y2={pad + i * cell} stroke={GRID} />
        </g>
      ))}
      {/* zone captions */}
      <text x={pad + 2.5 * cell} y={pad + 14} textAnchor="middle" fontSize="9" fill={TEAL} fontWeight="700">
        FUTURE LEADERS
      </text>
      <text x={pad + 0.5 * cell} y={pad + 2 * cell + 14} textAnchor="middle" fontSize="9" fill={AMBER} fontWeight="700">
        DEVELOP
      </text>
      {/* points */}
      {points.map((p) => {
        const px = pad + (Math.max(0, Math.min(100, p.x)) / 100) * plot;
        const py = pad + plot - (Math.max(0, Math.min(100, p.y)) / 100) * plot;
        return (
          <g key={p.name}>
            <circle cx={px} cy={py} r="11" fill="var(--navy-light)" stroke={TEAL} strokeWidth="1.5" />
            <text x={px} y={py + 3.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--text)">
              {initials(p.name)}
            </text>
            <title>{`${p.name} — capability ${Math.round(p.x)}, growth signal ${Math.round(p.y)}`}</title>
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
