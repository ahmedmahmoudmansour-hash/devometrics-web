"use server";

import { headers } from "next/headers";

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
