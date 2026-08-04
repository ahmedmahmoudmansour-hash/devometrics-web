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
};

export type OrgChartViewConfig = {
  toggles: OrgChartCardToggles;
  density: CardDensity;
  // Total visible tiers from each root (root itself counts as tier 1) —
  // null means unlimited. Adjustable 1-5 whenever active; a preset only
  // sets the starting value.
  maxDepth: number | null;
  filters: OrgChartFilters;
};

export type OrgChartPresetKey = "photo" | "nameOnly" | "positionOnly" | "compact" | "executive";

export const EXECUTIVE_MIN_DEPTH = 1;
export const EXECUTIVE_MAX_DEPTH = 5;
export const EXECUTIVE_DEFAULT_DEPTH = 2;

const NO_FILTERS: OrgChartFilters = { countries: [], businessUnits: [], departments: [] };

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
  },
  nameOnly: {
    toggles: toggles({ showName: true }),
    density: "comfortable",
    maxDepth: null,
    filters: NO_FILTERS,
  },
  positionOnly: {
    toggles: toggles({ showTitle: true, showDepartment: true }),
    density: "comfortable",
    maxDepth: null,
    filters: NO_FILTERS,
  },
  compact: {
    toggles: toggles({ showPhoto: true, showName: true, showTitle: true }),
    density: "compact",
    maxDepth: null,
    filters: NO_FILTERS,
  },
  executive: {
    toggles: toggles({ showPhoto: true, showName: true, showTitle: true, showDepartment: true, showPerformanceBadge: true, showSuccessionStatus: true }),
    density: "comfortable",
    maxDepth: EXECUTIVE_DEFAULT_DEPTH,
    filters: NO_FILTERS,
  },
};

export const DEFAULT_PRESET_KEY: OrgChartPresetKey = "photo";

export function defaultViewConfig(): OrgChartViewConfig {
  return ORG_CHART_PRESETS[DEFAULT_PRESET_KEY];
}
