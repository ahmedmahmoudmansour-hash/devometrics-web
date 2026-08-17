// Pure types + preset constants — no I/O, same spirit as tree.ts. The
// memo's 5 named display modes (photo/name-only/position-only/compact/
// executive) are NOT hardcoded rendering variants; they're just starting
// combinations of these generic field toggles. A user can start from a
// preset and then flip individual toggles — at that point the config is
// "custom" (presetKey becomes null) until saved under a name via
// lib/orgChart/savedViews.ts.

export type OrgChartCardToggles = {
  showPhoto: boolean;
  showName: boolean;
  showTitle: boolean;
  showDepartment: boolean;
  showLocation: boolean;
  showTenure: boolean;
  showPerformanceBadge: boolean;
  showSuccessionStatus: boolean;
  // Workstream 7 — shows a vacant position's linked-posting status and/or
  // linked-role grade on its card. Person cards ignore this toggle
  // entirely (neither field applies to a real employee). Defaults false in
  // every existing preset below; an old saved view's jsonb blob that
  // predates this key simply reads it as undefined/falsy, no data
  // migration needed.
  showPositionLinks: boolean;
};

export type CardDensity = "comfortable" | "compact";

export type OrgChartFilters = {
  countries: string[];
  businessUnits: string[];
  departments: string[];
  // "Build a chart from scratch": hand-pick exactly who appears (any
  // function, not department-specific), rather than starting from
  // everyone and narrowing down. When manualMode is true, includedIds
  // (tagged "member:<uuid>" / "position:<uuid>") is the ONLY thing that
  // decides visibility — countries/businessUnits/departments above are
  // ignored entirely while it's active. Reporting lines between whoever's
  // picked are still computed from real data (lib/orgChart/tree.ts's
  // pruning), same as every other filter mode — this only changes WHO is
  // eligible to appear, never how the lines between them are drawn.
  manualMode: boolean;
  includedIds: string[];
};

// Free-floating notes on the canvas — not attached to any position or
// person, unlike everything else the chart renders. x/y are pixel offsets
// in the same coordinate space as card positions (the div at `left: PAD,
// top: PAD` in OrgChartView), so an annotation drags and prints exactly
// like a card does.
//
// Lives inside OrgChartViewConfig — each named Saved View (lib/orgChart/
// savedViews.ts) is its own real chart (HR, Finance, Executive Board...)
// and each needs its own distinct set of notes, not one note layer shared
// across every chart. OrgChartView.tsx auto-persists annotation changes
// back into whichever saved view is currently active (see
// lib/orgChart/annotations.ts for the fallback used before any named view
// has been picked) so a note survives a refresh without a separate
// explicit "Save current view" click.
export type OrgChartAnnotation = {
  id: string;
  text: string;
  x: number;
  y: number;
};

export type OrgChartViewConfig = {
  toggles: OrgChartCardToggles;
  density: CardDensity;
  // Total visible tiers from each root (root itself counts as tier 1) —
  // null means unlimited. Adjustable 1-5 whenever active; a preset only
  // sets the starting value.
  maxDepth: number | null;
  filters: OrgChartFilters;
  annotations: OrgChartAnnotation[];
};

export type OrgChartPresetKey = "photo" | "nameOnly" | "positionOnly" | "compact" | "executive";

export const EXECUTIVE_MIN_DEPTH = 1;
export const EXECUTIVE_MAX_DEPTH = 5;
export const EXECUTIVE_DEFAULT_DEPTH = 2;

const NO_FILTERS: OrgChartFilters = { countries: [], businessUnits: [], departments: [], manualMode: false, includedIds: [] };

function toggles(overrides: Partial<OrgChartCardToggles>): OrgChartCardToggles {
  return {
    showPhoto: false,
    showName: false,
    showTitle: false,
    showDepartment: false,
    showLocation: false,
    showTenure: false,
    showPerformanceBadge: false,
    showSuccessionStatus: false,
    showPositionLinks: false,
    ...overrides,
  };
}

export const ORG_CHART_PRESETS: Record<OrgChartPresetKey, OrgChartViewConfig> = {
  photo: {
    toggles: toggles({ showPhoto: true, showName: true, showTitle: true }),
    density: "comfortable",
    maxDepth: null,
    filters: NO_FILTERS,
    annotations: [],
  },
  nameOnly: {
    toggles: toggles({ showName: true }),
    density: "comfortable",
    maxDepth: null,
    filters: NO_FILTERS,
    annotations: [],
  },
  positionOnly: {
    toggles: toggles({ showTitle: true, showDepartment: true }),
    density: "comfortable",
    maxDepth: null,
    filters: NO_FILTERS,
    annotations: [],
  },
  compact: {
    toggles: toggles({ showPhoto: true, showName: true, showTitle: true }),
    density: "compact",
    maxDepth: null,
    filters: NO_FILTERS,
    annotations: [],
  },
  executive: {
    toggles: toggles({ showPhoto: true, showName: true, showTitle: true, showDepartment: true, showPerformanceBadge: true, showSuccessionStatus: true }),
    density: "comfortable",
    maxDepth: EXECUTIVE_DEFAULT_DEPTH,
    filters: NO_FILTERS,
    annotations: [],
  },
};

export const DEFAULT_PRESET_KEY: OrgChartPresetKey = "photo";

export function defaultViewConfig(): OrgChartViewConfig {
  return ORG_CHART_PRESETS[DEFAULT_PRESET_KEY];
}
