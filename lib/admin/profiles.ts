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

// Platform-wide equivalent of admin_schedule_employee_data_deletion
// (migration 0066), which only works when the caller is that specific
// employee's own org admin. This works on any user platform-wide, gated
// by the caller's own is_admin flag via the SECURITY DEFINER function
// (migration 0111) — same 30-day-grace-period, same daily purge cron
// (migration 0059) as every other path into this deletion mechanism. Does
// NOT delete the login itself — no service_role key in this app means
// that's a Supabase Dashboard action only, never something server code
// here can do.
export async function platformAdminScheduleDataDeletion(
  targetUserId: string
): Promise<{ error: string } | { success: true; deletionAt: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase.rpc("platform_admin_schedule_data_deletion", {
    target_user_id: targetUserId,
    grace_days: 30,
  });
  if (error) {
    console.error("platformAdminScheduleDataDeletion failed:", error);
    return { error: "Could not schedule deletion — the database may need migration 0111 run first." };
  }

  revalidatePath("/dashboard/admin");
  return { success: true, deletionAt: data as string };
}

export async function platformAdminCancelDataDeletion(targetUserId: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.rpc("platform_admin_cancel_data_deletion", { target_user_id: targetUserId });
  if (error) {
    console.error("platformAdminCancelDataDeletion failed:", error);
    return { error: "Could not cancel — try again." };
  }

  revalidatePath("/dashboard/admin");
  return { success: true };
}

// Blocks/restores login+use of the app without touching any of the user's
// content — the opposite of platformAdminScheduleDataDeletion above, which
// wipes content but leaves login intact. Goes through the same "Platform
// admins can update any profile" RLS policy (migration 0091) as
// updateUserSubscriptionTier below; migration 0112 extends the
// self-escalation guard (0092) to cover this new column so a disabled
// user can't just flip their own flag back via a direct client update.
export async function setUserDisabled(userId: string, disabled: boolean): Promise<{ error: string } | { success: true }> {
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

  const { error } = await supabase.from("profiles").update({ is_disabled: disabled }).eq("id", userId);
  if (error) {
    console.error("setUserDisabled failed:", error);
    return { error: "Could not update — the database may need migration 0112 run first." };
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
