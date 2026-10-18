"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isInviteToken } from "@/lib/auth/inviteLink";

// Simple shared-secret gate in front of signup while the app is invite-only
// (testing phase, not a public launch yet). Deliberately a single env-var
// code, not a database table of per-person codes — this is the "friends and
// early testers" stage, not multi-tenant invite management. Revisit this
// once real self-serve public signup is actually wanted.
//
// In-memory, per-process rate limit on guesses — same caveat as the
// platform chat limiter: fine for a single small instance, resets on
// restart, doesn't share state across multiple server instances. Enough to
// stop casual brute-forcing of a short shared code, not a hardened bound.
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

export async function verifyInviteCode(code: string): Promise<{ ok: boolean; error?: string }> {
  if (await isRateLimited()) {
    return { ok: false, error: "Too many attempts — please wait a while and try again." };
  }

  const expected = process.env.SIGNUP_INVITE_CODE;
  if (!expected) {
    // Misconfiguration should fail closed, not silently let everyone in.
    return { ok: false, error: "Signup is currently unavailable." };
  }

  if (code.trim().toLowerCase() !== expected.trim().toLowerCase()) {
    return { ok: false, error: "That invite code isn't valid." };
  }

  return { ok: true };
}

// A person whose company invited them by email does not need the platform code:
// their invitation link carries the invitation's own random id, and the
// database (signup_invite_is_valid, 0201) confirms it is an unused invitation
// for exactly this email. Same guess limit as the code, so the id cannot be
// probed. Account ownership is still proven by the confirmation email.
export async function verifySignupInvite(inviteId: string, email: string): Promise<{ ok: boolean; error?: string }> {
  if (await isRateLimited()) {
    return { ok: false, error: "Too many attempts — please wait a while and try again." };
  }
  if (!isInviteToken(inviteId) || !email.trim()) {
    return { ok: false, error: "This invitation link isn't valid." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("signup_invite_is_valid", { p_invite_id: inviteId, p_email: email.trim() });
  if (error) {
    console.error("signup_invite_is_valid failed:", error);
    return { ok: false, error: "We couldn't check your invitation just now. Try again, or use an invite code." };
  }
  if (data !== true) {
    return { ok: false, error: "This invitation is for a different email address, or has already been used." };
  }
  return { ok: true };
}
