// Three ready-made per-seat AI budget packages, so setting an org's
// Monthly AI Budget is "pick Starter/Growth/Scale" instead of doing this
// math by hand for every deal.
//
// Derivation: every AI-gated feature (see AiUsageFeature in
// lib/aiUsage/track.ts) was priced per-call using its real production
// model + real max_tokens cap (both read directly from the call sites),
// with input/output token counts either taken from a real measured API
// call (scripts/compare-coach-cost.mjs, scripts/compare-medium-
// extraction.mjs — Coach $0.00261/msg, career_profile_extraction
// $0.00637/call) or modeled from the actual content each feature
// processes (a resume, a candidate pool, a review cycle, ...) at
// output ≈ 55% of its real max_tokens cap. Those per-call costs were
// then rolled up into a monthly per-employee figure at three usage
// intensities:
//   Starter (light): occasional Coach use, rare Gap Analysis/Resume runs
//   Growth (standard): regular Coach use, quarterly Gap Analysis/Resume/
//     Performance Review, light hiring activity
//   Scale (heavy): daily Coach use, monthly Gap Analysis, active hiring
//     and succession/exit-interview usage
// Each package price is that modeled monthly-per-employee cost with a
// ~6-8x safety margin, rounded to a clean number — comfortably above
// typical usage so a real month's spend rarely approaches the cap, while
// still being a small fraction of the $8.99–$15.99/seat/month Enterprise
// price (lib/billing/pricingTiers.ts) so it never threatens deal margin.
export type AiBudgetPackage = {
  id: "starter" | "growth" | "scale";
  perSeatUsd: number;
};

export const AI_BUDGET_PACKAGES: AiBudgetPackage[] = [
  { id: "starter", perSeatUsd: 0.75 },
  { id: "growth", perSeatUsd: 2.0 },
  { id: "scale", perSeatUsd: 4.0 },
];

// Rounds to a whole dollar — a budget field asking for exact cents off a
// modeled per-seat rate would imply false precision.
export function packageBudgetForSeats(perSeatUsd: number, seats: number): number {
  return Math.max(1, Math.round(perSeatUsd * Math.max(seats, 1)));
}
