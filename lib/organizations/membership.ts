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

// Same calling convention as hasOrganizationMembership — for call sites
// that need the actual organization_id (e.g. to check feature restrictions
// via list_my_restricted_features) rather than just a yes/no. Individual
// accounts (no membership row) get null, same as every other org-scoped
// check in this app.
export async function getMyOrganizationId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .maybeSingle<{ organization_id: string }>();
  return data?.organization_id ?? null;
}
