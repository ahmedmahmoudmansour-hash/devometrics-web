import type { Profile } from "@/lib/supabase/types";

export type SubscriptionTier = "free" | "premium" | "enterprise";

// The single place gating logic should ever read tier from — a stored
// 'premium' with an expired trial date must behave exactly like 'free',
// and every caller (plan generation, dashboard widgets) needs that same
// rule applied consistently rather than re-deriving it inline each time.
// Platform admins (is_admin, set via the operator's own account — distinct
// from org-workspace "admin" membership) always get full access: they
// shouldn't need a trial code or manual SQL update just to test the
// product they run. Every tier check downstream only ever branches on
// "=== free" vs. not, so "enterprise" here is just a label, not a
// different code path.
//
// hasOrgMembership is a required (not optional) second param on purpose —
// the pricing page promises Enterprise gets "Everything in Individual, for
// every seat," and making this param required means every call site has to
// consciously supply it (via hasOrganizationMembership() in
// lib/organizations/membership.ts, or a membership row already in scope)
// rather than silently defaulting to false and quietly leaving some
// enterprise employees gated as free, which is exactly the inconsistency
// this was added to close.
export function effectiveSubscriptionTier(
  profile: Pick<Profile, "subscription_tier" | "premium_trial_expires_at" | "is_admin"> | null,
  hasOrgMembership: boolean
): SubscriptionTier {
  if (profile?.is_admin || hasOrgMembership) return "enterprise";
  if (!profile) return "free";
  if (profile.subscription_tier === "free") return "free";
  if (profile.premium_trial_expires_at && new Date(profile.premium_trial_expires_at) < new Date()) {
    return "free";
  }
  return profile.subscription_tier;
}
