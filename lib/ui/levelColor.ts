// Shared score-band coloring for anything that shows a 0-100 competency
// level as a colored chip/cell (CapabilityPyramid, Talent heatmap). Built
// from theme-aware CSS custom properties (not hardcoded hex/rgba) via
// color-mix, so light mode gets the light theme's own contrast-checked
// --teal/--amber/--danger values instead of the dark theme's values washed
// out against a near-white background.
export function levelBg(level: number | null | undefined): string {
  if (level === null || level === undefined) return "color-mix(in srgb, var(--text-muted) 8%, transparent)";
  if (level >= 70) return "color-mix(in srgb, var(--teal) 24%, transparent)";
  if (level >= 40) return "color-mix(in srgb, var(--amber) 24%, transparent)";
  return "color-mix(in srgb, var(--danger) 24%, transparent)";
}

export function levelText(level: number | null | undefined): string {
  if (level === null || level === undefined) return "var(--text-muted)";
  if (level >= 70) return "var(--teal)";
  if (level >= 40) return "var(--amber)";
  return "var(--danger)";
}
