import type { TrendPoint } from "@/lib/scorecard/aggregate";

const WIDTH = 320;
const HEIGHT = 100;
const PADDING = 8;

export default function ScoreTrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) {
    return (
      <div style={{ height: HEIGHT, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Run this again to start seeing a trend line.
        </p>
      </div>
    );
  }

  const usableWidth = WIDTH - PADDING * 2;
  const usableHeight = HEIGHT - PADDING * 2;
  const xStep = usableWidth / (points.length - 1);

  const coords = points.map((p, i) => ({
    x: PADDING + i * xStep,
    y: PADDING + usableHeight * (1 - p.score / 100),
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${HEIGHT - PADDING} L ${coords[0].x} ${HEIGHT - PADDING} Z`;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT} role="img" aria-label="Score trend over time">
      <path d={areaPath} fill="var(--teal)" fillOpacity={0.12} stroke="none" />
      <path d={linePath} fill="none" stroke="var(--teal)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={3} fill="var(--teal)" />
      ))}
    </svg>
  );
}
