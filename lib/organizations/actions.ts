"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrganizationInvite, OrganizationMember } from "@/lib/supabase/types";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Short random suffix so two companies with the same display name
  // ("Acme") don't collide on the unique slug used as the join code.
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "company"}-${suffix}`;
}

export async function getMyOrganizationMembership(): Promise<
  (OrganizationMember & { organization_name: string }) | null
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("organization_members")
    .select("*, organizations(name)")
    .eq("user_id", user.id)
    .maybeSingle<OrganizationMember & { organizations: { name: string } }>();

  if (!data) return null;
  const { organizations, ...member } = data;
  return { ...member, organization_name: organizations.name };
}

// Creates a brand-new company workspace with the current user as its admin.
// Two inserts, not a single transaction (no RPC/service-role access in this
// app) — if the membership insert fails after the org insert succeeds, the
// user is left with an orphaned org and no membership, which the RLS insert
// policy in 0016 would let them retry (they still satisfy created_by = self).
export async function createOrganization(
  name: string,
  profile?: { website?: string; employeeCount?: string; industry?: string; adminTitle?: string }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const trimmed = name.trim();
  if (!trimmed) return { error: "Company name is required" };

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: trimmed,
      slug: slugify(trimmed),
      created_by: user.id,
      website: profile?.website?.trim() || null,
      employee_count: profile?.employeeCount || null,
      industry: profile?.industry || null,
    })
    .select()
    .single();
  if (orgError || !org) return { error: "Could not create company workspace" };

  const { error: memberError } = await supabase
    .from("organization_members")
    .insert({ organization_id: org.id, user_id: user.id, role: "admin", title: profile?.adminTitle?.trim() || null });
  if (memberError) return { error: "Company created, but joining it failed — try again" };

  revalidatePath("/dashboard");
  redirect("/dashboard/company");
}

// Named contacts beyond the admin who signed up — day-to-day platform
// contact and a separate billing/finance contact, matching real B2B
// onboarding conventions. Editable any time from the company dashboard,
// not forced at initial signup (you may not know your finance contact yet
// when just spinning up a trial workspace).
export async function updateOrganizationContacts(
  organizationId: string,
  fields: {
    platformContactName?: string;
    platformContactEmail?: string;
    financeContactName?: string;
    financeContactEmail?: string;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("organizations")
    .update({
      platform_contact_name: fields.platformContactName?.trim() || null,
      platform_contact_email: fields.platformContactEmail?.trim() || null,
      finance_contact_name: fields.financeContactName?.trim() || null,
      finance_contact_email: fields.financeContactEmail?.trim() || null,
    })
    .eq("id", organizationId);
  if (error) return { error: "Could not save contacts — try again." };

  revalidatePath("/dashboard/company");
  return { success: true };
}

// Website/employee count/industry are set at initial workspace creation
// (CompanySetupForm) but weren't editable afterward until now — a company's
// size or industry can change, or an admin may just not have known the
// website URL yet when first spinning up the workspace.
export async function updateOrganizationProfile(
  organizationId: string,
  fields: { website?: string; employeeCount?: string; industry?: string }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("organizations")
    .update({
      website: fields.website?.trim() || null,
      employee_count: fields.employeeCount || null,
      industry: fields.industry || null,
    })
    .eq("id", organizationId);
  if (error) return { error: "Could not save company profile — try again." };

  revalidatePath("/dashboard/company");
  return { success: true };
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

// Lets an org admin apply a custom logo + accent color, picked up by every
// member's dashboard via the layout-level override in app/dashboard/layout.tsx
// (a single CSS custom-property swap, not per-page plumbing).
export async function updateOrganizationBranding(
  organizationId: string,
  fields: { logoUrl?: string; brandColor?: string }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const brandColor = fields.brandColor?.trim() || null;
  if (brandColor && !HEX_COLOR_RE.test(brandColor)) {
    return { error: "Brand color must be a hex code like #00C9A7" };
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      logo_url: fields.logoUrl?.trim() || null,
      brand_color: brandColor,
    })
    .eq("id", organizationId);
  if (error) return { error: "Could not save branding — try again." };

  revalidatePath("/dashboard/company");
  revalidatePath("/dashboard", "layout");
  return { success: true };
}

// Joins an existing company workspace as a plain member via its invite
// code (the organization's slug). Deliberately always role = "member" —
// the RLS policy on organization_members enforces this server-side too,
// so this isn't just an application-level rule.
export async function joinOrganization(inviteCode: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const trimmed = inviteCode.trim().toLowerCase();
  if (!trimmed) return { error: "Invite code is required" };

  const { data: org } = await supabase.from("organizations").select("id").eq("slug", trimmed).maybeSingle();
  if (!org) return { error: "No company found with that invite code" };

  const { error } = await supabase
    .from("organization_members")
    .insert({ organization_id: org.id, user_id: user.id, role: "member" });
  if (error) return { error: "Could not join that company — you may already be a member" };

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// Admin-controlled authorization list — the app has no service-role key, so
// it can't create an employee's login directly. What this does is let an
// admin pre-authorize a specific email; when that person actually signs up
// themselves (choosing their own password), checkAndConsumeInvite attaches
// them automatically. No shared secret involved, unlike the org's slug/code.
export async function inviteEmployee(
  organizationId: string,
  email: string,
  title?: string,
  department?: string,
  country?: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) return { error: "A valid email is required" };

  const { error } = await supabase.from("organization_invites").insert({
    organization_id: organizationId,
    email: trimmed,
    invited_by: user.id,
    title: title?.trim() || null,
    department: department?.trim() || null,
    country: country?.trim() || null,
  });
  if (error) return { error: "Could not send invite — they may already be invited" };

  revalidatePath("/dashboard/company");
  return { success: true };
}

export async function revokeInvite(inviteId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("organization_invites").delete().eq("id", inviteId);
  revalidatePath("/dashboard/company");
}

// Called on every dashboard load for users with no org membership yet —
// checks whether an admin pre-authorized their email, and if so, joins
// them automatically. Matches against the user's own verified email from
// their session, never a client-supplied string, so this can't be used to
// join an arbitrary organization.
export async function checkAndConsumeInvite(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return false;

  const { data: invite } = await supabase
    .from("organization_invites")
    .select("*")
    .is("accepted_at", null)
    .ilike("email", user.email)
    .maybeSingle<OrganizationInvite>();
  if (!invite) return false;

  const { error: memberError } = await supabase.from("organization_members").insert({
    organization_id: invite.organization_id,
    user_id: user.id,
    role: "member",
    title: invite.title ?? null,
    department: invite.department ?? null,
    country: invite.country ?? null,
  });
  if (memberError) return false;

  await supabase.from("organization_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
  return true;
}

// For plain members only — admins don't "leave," since there's no other
// admin to hand the workspace to in this build. Deleting their own
// membership row is enough; their personal data (gap analyses, plans, etc.)
// belongs to them, not the org, and is untouched.
export async function leaveOrganization() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle<{ role: string }>();

  if (!membership) return { error: "You're not part of a company workspace" };
  if (membership.role === "admin") {
    return { error: "As the workspace admin, use \"Delete company workspace\" instead — there's no other admin to hand this off to." };
  }

  const { error } = await supabase.from("organization_members").delete().eq("user_id", user.id);
  if (error) return { error: "Could not leave the company — try again" };

  revalidatePath("/dashboard");
  return { success: true };
}

// Lets an org admin assign a task straight onto an employee's development
// plan — creates a default plan for them first if they don't have one yet.
// Both inserts rely on the RLS policies added in 0031 (scoped through
// is_org_admin_of_user), not on any elevated/service-role access — an admin
// can only ever write into a plan owned by someone in their own org.
export async function assignTaskToEmployee(
  employeeUserId: string,
  planId: string | null,
  fields: { title: string; description?: string; targetDate?: string }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const title = fields.title.trim();
  if (!title) return { error: "Task title is required" };

  let targetPlanId = planId;
  if (!targetPlanId) {
    const { data: plan, error: planError } = await supabase
      .from("development_plans")
      .insert({ user_id: employeeUserId, title: "Personal Development Plan" })
      .select()
      .single();
    if (planError || !plan) return { error: "Could not create a plan for this employee" };
    targetPlanId = plan.id;
  }

  const { error } = await supabase.from("milestones").insert({
    plan_id: targetPlanId,
    title,
    description: fields.description?.trim() || null,
    target_date: fields.targetDate || null,
    assigned_by: user.id,
  });
  if (error) return { error: "Could not assign task — try again" };

  revalidatePath(`/dashboard/company/${employeeUserId}`);
  revalidatePath("/dashboard/company/employees");
  return { success: true };
}

// Admin-only, deletes the whole workspace. Cascades to organization_members
// and organization_invites via the on-delete-cascade FKs in 0016/0017 — one
// delete, not a manual cleanup of each child table.
export async function deleteOrganization(organizationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("organizations").delete().eq("id", organizationId);
  if (error) return { error: "Could not delete the company workspace — try again" };

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
