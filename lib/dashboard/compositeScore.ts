// Shared by CareerHealthOverview (display) and the momentum snapshot (lib/momentum) —
// one definition of "composite score" so the two never drift apart.
export function computeCompositeScore(scores: (number | null)[]): number | null {
  const valid = scores.filter((s): s is number => s !== null);
  return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
}
