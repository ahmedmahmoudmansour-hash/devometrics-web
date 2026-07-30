"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SubscriptionTier } from "@/lib/billing/subscriptionTier";

// null clears the budget back to unlimited — same "just set a new number"
// posture as updateOrgAiBudget, this is how a platform admin raises an
// individual's cap on request.
export async function updateProfileAiBudget(userId: string, budgetUsd: number | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single<{ is_admin: boolean }>();
  if (!ownProfile?.is_admin) return { error: "Not authorized" };

  if (budgetUsd !== null && (!Number.isFinite(budgetUsd) || budgetUsd < 0)) {
    return { error: "Budget must be a non-negative number, or blank for unlimited" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ monthly_ai_budget_usd: budgetUsd })
    .eq("id", userId);
  if (error) {
    console.error("updateProfileAiBudget failed:", error);
    return { error: "Could not update — the database may need migration 0091 run first." };
  }

  revalidatePath("/dashboard/admin");
  return { success: true };
}

const VALID_TIERS: SubscriptionTier[] = ["free", "premium", "enterprise"];

// Grants/revokes premium the same way the documented manual SQL fix does
// (see migration 0013's comment for the is_admin equivalent) — setting a
// non-free tier also clears premium_trial_expires_at so it reads as
// permanent rather than as a trial that happens to expire later. Going
// back to 'free' clears it too, so there's never a stale expiry timestamp
// sitting under a tier it no longer describes.
export async function updateUserSubscriptionTier(userId: string, tier: SubscriptionTier) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single<{ is_admin: boolean }>();
  if (!ownProfile?.is_admin) return { error: "Not authorized" };

  if (!VALID_TIERS.includes(tier)) return { error: "Invalid subscription tier" };

  const { error } = await supabase
    .from("profiles")
    .update({ subscription_tier: tier, premium_trial_expires_at: null })
    .eq("id", userId);
  if (error) {
    console.error("updateUserSubscriptionTier failed:", error);
    return { error: "Could not update — try again." };
  }

  revalidatePath("/dashboard/admin");
  return { success: true };
}
