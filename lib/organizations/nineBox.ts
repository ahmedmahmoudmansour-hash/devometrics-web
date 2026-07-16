// Shared 9-box math — previously duplicated (identically) in the org-wide
// Analytics scatter plot and the individual employee report's own-position
// chart. Extracted here so a third caller (the High Potential Pool roster)
// doesn't become a fourth copy of the same formula, and so all three stay
// honest about using the exact same capability/growth-signal definition.
import type { CompetencyDimension } from "@/lib/gap-analysis/dimensions";
import { NINE_BOX_ZONES } from "@/components/dashboard/charts";

export const NINE_BOX_LEADERSHIP_DIMENSIONS: CompetencyDimension[] = [
  "Leadership",
  "Strategic Thinking",
  "People Management",
];

// x = overall measured capability (avg of every dimension the person has a
// level for), y = leadership growth signal (avg of the leadership-oriented
// dimensions only). Both 0-100. Returns null the same way an unmeasured
// person yields no point on the chart — no Gap Analysis, no position.
export function computeNineBoxPoint(
  dimensionLevels: Partial<Record<CompetencyDimension, number>>
): { x: number; y: number } | null {
  const values = Object.values(dimensionLevels) as number[];
  if (values.length === 0) return null;
  const leadershipValues = NINE_BOX_LEADERSHIP_DIMENSIONS.map((d) => dimensionLevels[d]).filter(
    (v): v is number => v !== undefined
  );
  if (leadershipValues.length === 0) return null;
  return {
    x: values.reduce((a, b) => a + b, 0) / values.length,
    y: leadershipValues.reduce((a, b) => a + b, 0) / leadershipValues.length,
  };
}

// Same thirds-of-0-100 boundary the grid itself draws (see NineBoxGrid in
// components/dashboard/charts.tsx) — kept as one function so the roster
// list and the visual grid can never silently drift apart on where a
// boundary falls.
export function zoneForPoint(x: number, y: number) {
  const col = Math.min(2, Math.floor((Math.max(0, Math.min(100, x)) / 100) * 3)) as 0 | 1 | 2;
  const row = Math.min(2, Math.floor((Math.max(0, Math.min(100, y)) / 100) * 3)) as 0 | 1 | 2;
  return NINE_BOX_ZONES.find((z) => z.row === row && z.col === col)!;
}
