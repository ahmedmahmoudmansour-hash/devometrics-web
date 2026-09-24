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

// A resigned/terminated member (0172) can still resolve an organization_id
// via getMyOrganizationId above — that's deliberate (0145's self-visible
// carve-out exists for an unrelated RETURNING-clause bug, and preserving
// "I was a member here" is reasonable historical fact) — but it means a
// self-service page can't tell "has an org" apart from "still has real
// access to it" without checking this separately. Pages that render a
// full self-service UI (Services/leave, My Team, ...) should call this
// and show a clear "no longer have access" state instead of silently
// rendering an org-shaped page with empty data when it's false.
export async function amIActiveOrgMember(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("organization_members")
    .select("employment_status")
    .eq("user_id", userId)
    .maybeSingle<{ employment_status: string | null }>();
  return (data?.employment_status ?? "active") === "active";
}
