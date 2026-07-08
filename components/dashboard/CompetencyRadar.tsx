import type { CompetencyScore } from "@/lib/gap-analysis/dimensions";

const CENTER = 150;
const RADIUS = 110;

function pointAt(index: number, total: number, fraction: number) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const r = RADIUS * fraction;
  return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
}

function polygonPoints(fractions: number[]) {
  return fractions
    .map((f, i) => {
      const p = pointAt(i, fractions.length, f);
      return `${p.x},${p.y}`;
    })
    .join(" ");
}

export default function CompetencyRadar({ competencies }: { competencies: CompetencyScore[] }) {
  if (competencies.length === 0) return null;

  const rings = [0.25, 0.5, 0.75, 1];
  const currentPoints = polygonPoints(competencies.map((c) => c.currentLevel / 100));
  const targetPoints = polygonPoints(competencies.map((c) => c.targetLevel / 100));

  return (
    <svg viewBox="0 0 300 340" className="w-full h-full" role="img" aria-label="Skill Radar">
      {rings.map((r) => (
        <polygon
          key={r}
          points={polygonPoints(competencies.map(() => r))}
          fill="none"
          stroke="var(--border)"
          strokeWidth={1}
        />
      ))}
      {competencies.map((_, i) => {
        const p = pointAt(i, competencies.length, 1);
        return <line key={i} x1={CENTER} y1={CENTER} x2={p.x} y2={p.y} stroke="var(--border)" strokeWidth={1} />;
      })}
      <polygon points={targetPoints} fill="none" stroke="var(--teal)" strokeWidth={1.5} strokeDasharray="4 3" />
      <polygon points={currentPoints} fill="var(--teal)" fillOpacity={0.18} stroke="var(--teal)" strokeWidth={2} />
      {competencies.map((c, i) => {
        const p = pointAt(i, competencies.length, 1.16);
        return (
          <text
            key={c.dimension}
            x={p.x}
            y={p.y}
            fontSize={10}
            fill="var(--text-muted)"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {c.dimension}
          </text>
        );
      })}
    </svg>
  );
}
