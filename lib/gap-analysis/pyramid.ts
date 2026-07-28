import { type CompetencyDimension } from "./dimensions";

// Our own capability pyramid — inspired by ATD's Talent Development Capability
// Model in shape (personal -> professional -> organizational impact), but not
// a reproduction of ATD's copyrighted content or graphic. Every dimension from
// COMPETENCY_DIMENSIONS appears in exactly one tier, so this is just a
// different lens on data the product already scores, not a new taxonomy.
export type PyramidTier = {
  key: "personal" | "professional" | "organizational";
  label: string;
  subtitle: string;
  dimensions: CompetencyDimension[];
};

export const PYRAMID_TIERS: PyramidTier[] = [
  {
    key: "organizational",
    label: "Organizational & Leadership Capability",
    subtitle: "Impacting others and the business",
    dimensions: ["Leadership", "Strategic Thinking", "People Management", "Financial Literacy"],
  },
  {
    key: "professional",
    label: "Professional & Technical Capability",
    subtitle: "Applied, domain-specific execution",
    dimensions: ["Technical Skills", "AI & Digital Skills"],
  },
  {
    key: "personal",
    label: "Personal Capability",
    subtitle: "The foundation everything else builds on",
    dimensions: ["Communication", "Critical Thinking"],
  },
];

// Stable tier key -> translated label/subtitle, same pattern as
// dimensionLabel above. CapabilityPyramid.tsx is the only renderer.
const TIER_LABEL_KEY: Record<PyramidTier["key"], string> = {
  organizational: "organizationalLabel",
  professional: "professionalLabel",
  personal: "personalLabel",
};
const TIER_SUBTITLE_KEY: Record<PyramidTier["key"], string> = {
  organizational: "organizationalSubtitle",
  professional: "professionalSubtitle",
  personal: "personalSubtitle",
};

export function tierLabel(t: (key: string) => string, tier: PyramidTier): string {
  return t(TIER_LABEL_KEY[tier.key]);
}

export function tierSubtitle(t: (key: string) => string, tier: PyramidTier): string {
  return t(TIER_SUBTITLE_KEY[tier.key]);
}

export function tierAverage(
  tier: PyramidTier,
  dimensionLevels: Partial<Record<CompetencyDimension, number>>
): number | null {
  const values = tier.dimensions
    .map((d) => dimensionLevels[d])
    .filter((v): v is number => v !== undefined);
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}
