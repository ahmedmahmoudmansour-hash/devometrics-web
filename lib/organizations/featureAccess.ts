"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isRestrictableFeature, type RestrictableFeature, type FeatureRestrictionRow } from "@/lib/organizations/featureAccessConstants";
import { restrictedEmployeeFeatures } from "@/lib/organizations/companyTiles";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// The one call every gated page/action makes. Individual accounts (no org)
// have nothing to restrict — organizationId is null for them, and this
// short-circuits before ever hitting the database.
export async function listMyRestrictedFeatures(
  supabase: SupabaseServerClient,
  organizationId: string | null
): Promise<Set<RestrictableFeature>> {
  if (!organizationId) return new Set();
  const [{ data, error }, { data: org }] = await Promise.all([
    supabase.rpc("list_my_restricted_features", { check_org_id: organizationId }),
    supabase.from("organizations").select("disabled_company_features").eq("id", organizationId).maybeSingle<{ disabled_company_features: string[] | null }>(),
  ]);
  const restricted = new Set<RestrictableFeature>();
  if (!error && data) for (const k of data as string[]) if (isRestrictableFeature(k)) restricted.add(k);
  // Company-wide "Tiles & features" switches (0179): a switched-off feature
  // that has an employee-facing module restricts it for everyone, through
  // this same set every existing gate already reads.
  for (const k of restrictedEmployeeFeatures(org?.disabled_company_features ?? [])) restricted.add(k);
  return restricted;
}

async function requireOrgAdmin(organizationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Not authenticated" as const };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle<{ role: string }>();
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single<{ is_admin: boolean }>();
  if (membership?.role !== "admin" && !profile?.is_admin) return { supabase, error: "Not authorized" as const };

  return { supabase, error: null };
}

export async function listOrgFeatureRestrictions(organizationId: string): Promise<FeatureRestrictionRow[]> {
  const { supabase, error } = await requireOrgAdmin(organizationId);
  if (error) return [];

  const { data } = await supabase
    .from("organization_feature_restrictions")
    .select("id, feature_key, scope_type, user_id, department, profiles(full_name, email)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .returns<
      { id: string; feature_key: string; scope_type: "user" | "department"; user_id: string | null; department: string | null; profiles: { full_name: string | null; email: string | null } | null }[]
    >();

  return (data ?? [])
    .filter((r) => isRestrictableFeature(r.feature_key))
    .map((r) => ({
      id: r.id,
      featureKey: r.feature_key as RestrictableFeature,
      scopeType: r.scope_type,
      userId: r.user_id,
      userName: r.profiles?.full_name?.trim() || r.profiles?.email || null,
      department: r.department,
    }));
}

export async function addFeatureRestriction(
  organizationId: string,
  featureKey: RestrictableFeature,
  scope: { type: "user"; userId: string } | { type: "department"; department: string }
): Promise<{ error: string } | { success: true; id: string }> {
  const { supabase, error: authError } = await requireOrgAdmin(organizationId);
  if (authError) return { error: authError };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: inserted, error } = await supabase
    .from("organization_feature_restrictions")
    .insert({
      organization_id: organizationId,
      feature_key: featureKey,
      scope_type: scope.type,
      user_id: scope.type === "user" ? scope.userId : null,
      department: scope.type === "department" ? scope.department : null,
      created_by: user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !inserted) {
    // Unique-violation on the partial indexes means this exact restriction
    // already exists — a friendlier message than the raw constraint error.
    if (error?.code === "23505") return { error: "This restriction already exists" };
    console.error("addFeatureRestriction failed:", error);
    return { error: "Could not add restriction — the database may need migration 0114 run first." };
  }

  revalidatePath("/dashboard/company/permissions");
  return { success: true, id: inserted.id };
}

export async function removeFeatureRestriction(organizationId: string, restrictionId: string): Promise<{ error: string } | { success: true }> {
  const { supabase, error: authError } = await requireOrgAdmin(organizationId);
  if (authError) return { error: authError };

  const { error } = await supabase
    .from("organization_feature_restrictions")
    .delete()
    .eq("id", restrictionId)
    .eq("organization_id", organizationId);
  if (error) {
    console.error("removeFeatureRestriction failed:", error);
    return { error: "Could not remove restriction" };
  }

  revalidatePath("/dashboard/company/permissions");
  return { success: true };
}
