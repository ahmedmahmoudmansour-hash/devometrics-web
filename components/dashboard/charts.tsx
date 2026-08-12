"use client";

// Lightweight themed SVG charts — deliberately no charting library: the
// bundle stays small, everything inherits the CSS-variable theme (including
// enterprise brand-color overrides), and each chart renders identically in
// light/dark mode.

import { useTranslations } from "next-intl";
import { NINE_BOX_ZONES, zoneNeeds, zoneLabel } from "@/lib/organizations/nineBoxZones";

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

const DONUT_COLORS = [TEAL, "var(--phase2)", AMBER, "var(--phase3)", "var(--danger)", "#34d399", "#f472b6", "#a3e635"];

export function DonutChart({
  data,
  size = 150,
}: {
  data: { label: string; value: number }[];
  size?: number;
}) {
  const t = useTranslations("chartsCommon");
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
          {t("total")}
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
// borrowed ones. Zone data (NINE_BOX_ZONES, zoneNeeds) lives in
// lib/organizations/nineBoxZones.ts — a plain, non-"use client" module —
// so lib/organizations/nineBox.ts (used from many Server Component pages)
// can import the zone data without crossing this file's client boundary.

const ZONE_TONE_COLOR: Record<string, string> = {
  teal: TEAL,
  amber: AMBER,
  danger: "var(--danger)",
  muted: MUTED,
};

const ZONE_TONE_FILL: Record<string, string> = {
  teal: "rgba(var(--teal-rgb),0.10)",
  amber: "rgba(var(--amber-rgb),0.09)",
  danger: "rgba(var(--danger-rgb),0.08)",
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
  const t = useTranslations("nineBoxZones");
  const items = (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 10 }}>
      {[...NINE_BOX_ZONES]
        .sort((a, b) => b.row - a.row || a.col - b.col)
        .map((z) => (
          <div key={z.label} style={{ borderInlineStart: `2px solid ${ZONE_TONE_COLOR[z.tone]}`, paddingInlineStart: 10 }}>
            <p style={{ fontSize: 11.5, fontWeight: 700, color: ZONE_TONE_COLOR[z.tone] }}>{zoneLabel(t, z.label)}</p>
            <p style={{ fontSize: 11, color: MUTED, lineHeight: 1.5, marginTop: 2 }}>{zoneNeeds(t, z.label)}</p>
          </div>
        ))}
    </div>
  );

  if (forceOpen) {
    return (
      <div style={{ marginTop: 12 }}>
        <p style={{ fontSize: 11.5, fontWeight: 700, color: MUTED }}>{t("legendTitle")}</p>
        {items}
      </div>
    );
  }

  return (
    <details style={{ marginTop: 12 }}>
      <summary style={{ fontSize: 11.5, fontWeight: 700, color: MUTED, cursor: "pointer" }}>
        {t("legendTitle")}
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
  const t = useTranslations("nineBoxZones");
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
    <svg width="100%" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={t("gridAriaLabel")} style={{ maxWidth: 420 }}>
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
                {zoneLabel(t, zone.label)}
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
            <title>{`${p.name} — ${xLabel.toLowerCase()} ${Math.round(p.x)}, ${yLabel.toLowerCase()} ${Math.round(p.y)} — zone: ${zoneLabel(t, zone.label)}`}</title>
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

// A trend line with a soft area fill and an emphasized, labeled endpoint —
// gaps (null months, e.g. no Gap Analysis run that month) break the line
// rather than interpolating or dropping to zero, since a gap is real
// information ("nothing measured this month"), not a value.
export function TrendLineChart({
  data,
  unit = "",
  color = TEAL,
  height = 120,
}: {
  data: { label: string; value: number | null }[];
  unit?: string;
  color?: string;
  height?: number;
}) {
  const width = 520;
  const padX = 14;
  const padTop = 18;
  const padBottom = 24;
  const plotW = width - padX * 2;
  const plotH = height - padTop - padBottom;

  const values = data.map((d) => d.value).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  // A little headroom above/below so the line never touches the frame.
  const yFor = (v: number) => padTop + plotH - ((v - min) / range) * plotH * 0.85 - plotH * 0.075;
  const xFor = (i: number) => padX + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);

  // Break into contiguous runs of non-null points — each run gets its own
  // path segment, so a null month renders as a genuine visual gap.
  const runs: { i: number; v: number }[][] = [];
  let current: { i: number; v: number }[] = [];
  data.forEach((d, i) => {
    if (d.value === null) {
      if (current.length > 0) runs.push(current);
      current = [];
    } else {
      current.push({ i, v: d.value });
    }
  });
  if (current.length > 0) runs.push(current);

  const linePath = (run: { i: number; v: number }[]) =>
    run.map((p, idx) => `${idx === 0 ? "M" : "L"} ${xFor(p.i)} ${yFor(p.v)}`).join(" ");
  const areaPath = (run: { i: number; v: number }[]) =>
    `${linePath(run)} L ${xFor(run[run.length - 1].i)} ${padTop + plotH} L ${xFor(run[0].i)} ${padTop + plotH} Z`;

  const lastPoint = [...data].reverse().find((d) => d.value !== null);
  const lastIndex = lastPoint ? data.lastIndexOf(lastPoint) : -1;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={data.map((d) => `${d.label}: ${d.value ?? "no data"}${unit}`).join(", ")}>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={padX} x2={width - padX} y1={padTop + plotH * f} y2={padTop + plotH * f} stroke={GRID} strokeDasharray="2 4" />
      ))}
      {runs.map((run, i) => (
        <g key={i}>
          <path d={areaPath(run)} fill={color} opacity={0.08} />
          <path d={linePath(run)} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
      {data.map((d, i) =>
        d.value === null ? null : (
          <g key={i}>
            <circle cx={xFor(i)} cy={yFor(d.value)} r={i === lastIndex ? 4.5 : 3} fill={i === lastIndex ? color : "var(--navy-mid)"} stroke={color} strokeWidth={i === lastIndex ? 0 : 2} />
            <title>{`${d.label}: ${d.value}${unit}`}</title>
          </g>
        )
      )}
      {lastIndex >= 0 && (
        <text x={xFor(lastIndex)} y={yFor(data[lastIndex].value as number) - 12} textAnchor="middle" fontSize="13" fontWeight="800" fill={color}>
          {data[lastIndex].value}{unit}
        </text>
      )}
      {data.map((d, i) => (
        <text key={i} x={xFor(i)} y={height - 6} textAnchor="middle" fontSize="10" fill={MUTED}>
          {d.label}
        </text>
      ))}
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
