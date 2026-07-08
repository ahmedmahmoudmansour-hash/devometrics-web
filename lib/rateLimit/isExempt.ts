import type { createClient } from "@/lib/supabase/server";

// Platform admins need to be able to hammer every AI-backed feature
// repeatedly while testing without tripping the same per-minute/per-hour
// caps real users are rate-limited by -- those caps exist to bound API
// spend from abuse, not to slow down the person running QA.
export async function isRateLimitExempt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle<{ is_admin: boolean | null }>();
  return !!data?.is_admin;
}
