"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// The one call any compensation-gated page/action makes. Deliberately does
// NOT check isOrgAdmin/is_admin anywhere in this file — being an org admin
// (or a platform admin) must never imply compensation access. See the
// build plan (C:\Users\Markatak\.claude\plans\recursive-sleeping-boole.md)
// for the full reasoning.
export async function hasCompensationAccess(supabase: SupabaseServerClient, organizationId: string | null): Promise<boolean> {
  if (!organizationId) return false;
  const { data, error } = await supabase.rpc("has_compensation_access", { check_org_id: organizationId });
  if (error || typeof data !== "boolean") return false;
  return data;
}

// Deliberately NOT a copy of featureAccess.ts's requireOrgAdmin() — that
// function has a platform-admin fallback (`profile.is_admin`) that lets
// Devometrics staff through, and checks role='admin', which any existing
// admin can grant to any member (setMemberRole in
// lib/organizations/actions.ts has no cap and no owner check). Granting
// salary-wide visibility to someone is a bigger decision than "is an admin"
// — it's gated on being the org's OWNER instead, mirroring the RLS policy
// on organization_compensation_admins (0156, is_org_owner). owner_user_id
// (0162) is the live, transferable pointer; falling back to created_by
// mirrors is_org_owner() itself, so a workspace whose owner account was
// ever deleted without a transfer first still has someone who can manage
// this. Platform admin has zero path here either way, matching every other
// compensation access point.
async function requireOrgOwner(organizationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "Not authenticated" as const };

  const { data: org } = await supabase
    .from("organizations")
    .select("owner_user_id, created_by")
    .eq("id", organizationId)
    .maybeSingle<{ owner_user_id: string | null; created_by: string }>();
  if ((org?.owner_user_id ?? org?.created_by) !== user.id) {
    return { supabase, user, error: "Only your company's owner can manage this" as const };
  }

  return { supabase, user, error: null };
}

// For the UI to decide whether to render the grant/revoke form at all,
// rather than showing it to a non-owner admin and having every submit fail
// with "Only your company's owner can manage this".
export async function isCompensationGrantOwner(organizationId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: org } = await supabase
    .from("organizations")
    .select("owner_user_id, created_by")
    .eq("id", organizationId)
    .maybeSingle<{ owner_user_id: string | null; created_by: string }>();
  return (org?.owner_user_id ?? org?.created_by) === user.id;
}

export type CompensationAdminGrant = { id: string; userId: string; userName: string | null; grantedAt: string };

// No owner-only precheck here — RLS itself (0156) already scopes the
// result correctly: the owner sees every grant, a grantee who isn't the
// owner sees only their own row (the separate self-select policy), and
// anyone else gets nothing back. This just needs an authenticated caller.
export async function listCompensationAdmins(organizationId: string): Promise<CompensationAdminGrant[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("organization_compensation_admins")
    .select("id, user_id, created_at, profiles(full_name, email)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .returns<{ id: string; user_id: string; created_at: string; profiles: { full_name: string | null; email: string | null } | null }[]>();

  return (data ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    userName: r.profiles?.full_name?.trim() || r.profiles?.email || null,
    grantedAt: r.created_at,
  }));
}

export async function grantCompensationAdmin(organizationId: string, userId: string): Promise<{ error: string } | { success: true }> {
  const { supabase, user, error: authError } = await requireOrgOwner(organizationId);
  if (authError || !user) return { error: authError ?? "Not authenticated" };

  const { error } = await supabase
    .from("organization_compensation_admins")
    .insert({ organization_id: organizationId, user_id: userId, granted_by: user.id });
  if (error) {
    if (error.code === "23505") return { error: "This person already has Compensation Admin access" };
    console.error("grantCompensationAdmin failed:", error);
    return { error: "Could not grant access — the database may need migration 0156 run first." };
  }

  revalidatePath("/dashboard/company/permissions");
  return { success: true };
}

export async function revokeCompensationAdmin(organizationId: string, grantId: string): Promise<{ error: string } | { success: true }> {
  const { supabase, error: authError } = await requireOrgOwner(organizationId);
  if (authError) return { error: authError };

  const { error } = await supabase
    .from("organization_compensation_admins")
    .delete()
    .eq("id", grantId)
    .eq("organization_id", organizationId);
  if (error) {
    console.error("revokeCompensationAdmin failed:", error);
    return { error: "Could not revoke access" };
  }

  revalidatePath("/dashboard/company/permissions");
  return { success: true };
}
