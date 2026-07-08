import type { CompetencyDimension } from "./dimensions";

export const RESOURCE_TIERS = ["Premium resources", "Budget-conscious mix", "Free & open resources only"] as const;
export type ResourceTier = (typeof RESOURCE_TIERS)[number];

// Both the strict free tier and the budget-conscious middle tier want to see
// free alternatives surfaced — the only difference is whether paid options
// are also shown alongside them (budget-conscious) or excluded entirely
// (free-only, handled separately by budgetNote's own branch).
export function showsFreeAlternative(tier: string | null | undefined): boolean {
  return tier === "Free & open resources only" || tier === "Budget-conscious mix";
}

// Real, genuinely free, well-known platforms — no paid trials, no fabricated
// course names or URLs. Named generically so the person can search for it
// themselves rather than following a link that might be stale.
export const FREE_RESOURCES: Record<CompetencyDimension, string[]> = {
  "Technical Skills": ["freeCodeCamp's free curriculum", "MIT OpenCourseWare"],
  Leadership: ["Coursera courses audited for free (no certificate)", "your public library's leadership section"],
  "Strategic Thinking": ["Coursera courses audited for free", "OpenStax's free business textbooks"],
  Communication: ["YouTube channels on communication skills", "your public library's communication section"],
  "AI & Digital Skills": ["Google's free \"Grow with Google\" digital skills training", "freeCodeCamp"],
  "Critical Thinking": ["Khan Academy", "OpenStax's free textbooks"],
  "People Management": ["Coursera courses audited for free", "your public library's management section"],
  "Financial Literacy": ["Khan Academy's personal finance courses", "OpenStax's free finance and economics textbooks"],
};

export function freeResourceNote(dimension: CompetencyDimension): string {
  const options = FREE_RESOURCES[dimension];
  return `Free option: try ${options[0]} or ${options[1]} — no subscription needed.`;
}
