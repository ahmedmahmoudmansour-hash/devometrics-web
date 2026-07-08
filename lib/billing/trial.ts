"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_TRIAL_DAYS = 14;

// Same in-memory, per-process rate limit pattern as lib/auth/inviteGate.ts
// — enough to stop casual brute-forcing of a short shared code, not a
// hardened bound, and resets on restart / doesn't share state across
// multiple server instances. Fine for the testing-phase scale this exists
// for.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, number[]>();

async function isRateLimited(): Promise<boolean> {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const now = Date.now();
  const timestamps = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  attempts.set(ip, timestamps);
  return timestamps.length > MAX_ATTEMPTS;
}

// Grants a time-limited Premium trial to whoever redeems the shared code —
// no real billing needed for testers to try the full plan-generation
// experience. Expiry is just a stored timestamp; effectiveSubscriptionTier()
// is what actually enforces it on every read, since there's no cron here to
// flip this back to 'free' when the trial ends.
export async function redeemPremiumTrialCode(code: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (await isRateLimited()) {
    return { error: "Too many attempts — please wait a while and try again." };
  }

  const expected = process.env.PREMIUM_TRIAL_CODE;
  if (!expected) {
    return { error: "Trial codes aren't available right now." };
  }
  if (code.trim().toLowerCase() !== expected.trim().toLowerCase()) {
    return { error: "That code isn't valid." };
  }

  const days = Number(process.env.PREMIUM_TRIAL_DAYS) || DEFAULT_TRIAL_DAYS;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("profiles")
    .update({ subscription_tier: "premium", premium_trial_expires_at: expiresAt })
    .eq("id", user.id);
  if (error) return { error: "Could not activate your trial — try again." };

  revalidatePath("/dashboard");
  return { success: true, expiresAt, days };
}
