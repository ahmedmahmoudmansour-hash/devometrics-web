import type { createClient } from "@/lib/supabase/server";

// Cheap existence check, kept separate from getMyOrganizationMembership()
// (lib/organizations/actions.ts) which does its own auth.getUser() call and
// returns the full membership row — this takes an already-resolved
// supabase client + userId (same calling convention as isRateLimitExempt),
// for call sites that only need the yes/no answer feeding into
// effectiveSubscriptionTier().
export async function hasOrganizationMembership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<boolean> {
  const { count } = await supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return (count ?? 0) > 0;
}
