"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";

const CODE_TTL_MS = 15 * 60 * 1000;

// Same in-memory, per-process rate limit pattern as lib/auth/inviteGate.ts —
// keyed by user id here rather than IP, since this only runs for signed-in
// users. Not a hardened bound, just enough to stop casual code-guessing.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  attempts.set(key, timestamps);
  return timestamps.length > MAX_ATTEMPTS;
}

// Consumer webmail domains don't count as a "school email" — this is a
// cheap filter, not real domain-list validation (schools use .edu, .ac.uk,
// .edu.au, and countless country-specific TLDs, so there's no clean
// allowlist). Rejecting the obvious personal-webmail case catches most
// casual abuse without needing a maintained list of every school domain.
const CONSUMER_WEBMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com",
  "aol.com", "live.com", "msn.com", "protonmail.com", "gmx.com",
]);

function looksLikeSchoolEmail(email: string): boolean {
  const match = /^[^\s@]+@([^\s@]+)$/.exec(email.trim().toLowerCase());
  if (!match) return false;
  return !CONSUMER_WEBMAIL_DOMAINS.has(match[1]);
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function requestStudentVerification(schoolEmail: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (isRateLimited(user.id)) {
    return { error: "Too many attempts — please wait a while and try again." };
  }

  const email = schoolEmail.trim().toLowerCase();
  if (!looksLikeSchoolEmail(email)) {
    return { error: "Please use your school/university email address, not a personal webmail account." };
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  const { error: insertError } = await supabase.from("student_verification_codes").insert({
    user_id: user.id,
    school_email: email,
    code,
    expires_at: expiresAt,
  });
  if (insertError) return { error: "Could not start verification — try again." };

  try {
    await sendEmail(
      email,
      "Your Devometrics student verification code",
      `<p>Your verification code is <strong>${code}</strong>. It expires in 15 minutes.</p>`
    );
  } catch {
    return { error: "Student verification isn't available yet — email sending isn't configured. Check back soon." };
  }

  return { success: true };
}

export async function confirmStudentVerification(code: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (isRateLimited(`confirm:${user.id}`)) {
    return { error: "Too many attempts — please wait a while and try again." };
  }

  const { data: row, error: fetchError } = await supabase
    .from("student_verification_codes")
    .select("id, school_email, code, expires_at, consumed_at")
    .eq("user_id", user.id)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError || !row) return { error: "Request a code first." };
  if (new Date(row.expires_at).getTime() < Date.now()) return { error: "That code has expired — request a new one." };
  if (row.code !== code.trim()) return { error: "That code isn't valid." };

  const { error: consumeError } = await supabase
    .from("student_verification_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);
  if (consumeError) return { error: "Could not verify — try again." };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ student_verified_at: new Date().toISOString(), student_school_email: row.school_email })
    .eq("id", user.id);
  if (profileError) return { error: "Could not verify — try again." };

  revalidatePath("/dashboard");
  return { success: true };
}
