export type PricingRegion = "premium" | "developing";

// Annual discount is deliberately steeper in the developing tier (~30% vs
// ~17%) — not an oversight, a real business tradeoff: card-decline and
// payment-friction rates are meaningfully higher in these markets, so
// converting someone to a single annual commitment is worth more than the
// same conversion in a market where recurring billing "just works."
export const PRICING: Record<PricingRegion, { monthly: number; annual: number }> = {
  premium: { monthly: 14.99, annual: 149.99 },
  developing: { monthly: 7.99, annual: 66.99 },
};

// Enterprise starting price — was previously shown as "Custom" with no
// number at all, which contradicts the product's own "self-serve, no sales
// call required" positioning everywhere else and is real friction for the
// small/medium teams that positioning targets (a price-less "Contact
// sales" wall reads as "built for big companies with procurement," not
// "sign up in a minute"). Same region split as the individual tiers.
// PLACEHOLDER NUMBERS — adjust freely, this is a starting proposal, not a
// number I have authority to finalize.
export const ENTERPRISE_PRICING: Record<PricingRegion, number> = {
  premium: 12,
  developing: 6,
};
export const ENTERPRISE_MIN_SEATS = 5;

export const STUDENT_DISCOUNT = 0.6;

export function studentPrice(region: PricingRegion, cadence: "monthly" | "annual"): number {
  return Math.round(PRICING[region][cadence] * (1 - STUDENT_DISCOUNT) * 100) / 100;
}

// Launch promotion: 25% off both tiers until the cutoff, then reverts to the
// plain PRICING values automatically -- no code change needed on the day it
// ends. If Lemon Squeezy variants are already live when this is applied,
// either set the variant price to match this discounted rate directly, or
// use a Lemon Squeezy discount code -- what's charged at checkout must match
// what's shown here.
export const PROMO_DISCOUNT = 0.25;
// Discount runs through Oct 31 — full price starts Nov 1, 2026.
export const PROMO_END_DATE = new Date("2026-11-01T00:00:00Z");

export function isPromoActive(now: Date = new Date()): boolean {
  return now < PROMO_END_DATE;
}

export function promoPrice(region: PricingRegion, cadence: "monthly" | "annual"): number {
  return Math.round(PRICING[region][cadence] * (1 - PROMO_DISCOUNT) * 100) / 100;
}

// ISO 3166-1 alpha-2 codes for the "premium" pricing tier — US/Canada,
// Europe (EU + UK + EEA + Switzerland), GCC, Australia, Taiwan. Everyone
// else (including China — real PPP pricing is income-based, not
// GDP-based) defaults to the developing-market tier.
const PREMIUM_COUNTRIES = new Set([
  "US", "CA",
  "GB", "DE", "FR", "IT", "ES", "NL", "BE", "AT", "SE", "DK", "FI", "NO", "CH", "IE", "PT", "GR",
  "PL", "CZ", "HU", "RO", "BG", "HR", "SK", "SI", "LT", "LV", "EE", "LU", "MT", "CY", "IS", "LI",
  "SA", "AE", "QA", "KW", "BH", "OM",
  "AU",
  "TW",
]);

// Defaults to "premium" when the country can't be detected at all — that's
// the safer failure mode (matches today's single global price) rather than
// silently under-charging whenever detection fails.
export function tierForCountry(countryCode: string | null): PricingRegion {
  if (!countryCode) return "premium";
  return PREMIUM_COUNTRIES.has(countryCode.toUpperCase()) ? "premium" : "developing";
}
