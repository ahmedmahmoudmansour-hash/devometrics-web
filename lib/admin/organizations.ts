"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/organizations/slug";
import { sendEmail } from "@/lib/email/resend";
import { renderEmail, escapeHtml } from "@/lib/email/template";

export type AdminOrganizationRow = {
  id: string;
  name: string;
  memberCount: number;
  seatLimit: number | null;
  monthlyAiBudgetUsd: number | null;
  spendThisMonthUsd: number;
  isDisabled: boolean;
  pendingDeletionAt: string | null;
};

// Platform-admin-only: how many seats each company has, and how many
// they're actually using. Relies on organizations' existing "any
// authenticated user can look up" SELECT policy (0016) for the org list
// itself, and a plain count query per org for headcount — this app has no
// service-role key, so there's no single aggregate query that bypasses RLS
// here.
export async function buildAdminOrganizations(): Promise<{ isAdmin: boolean; rows: AdminOrganizationRow[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { isAdmin: false, rows: [] };

  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single<{ is_admin: boolean }>();
  if (!ownProfile?.is_admin) return { isAdmin: false, rows: [] };

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, seat_limit, is_disabled, pending_deletion_at")
    .order("name", { ascending: true })
    .returns<{ id: string; name: string; seat_limit: number | null; is_disabled: boolean | null; pending_deletion_at: string | null }[]>();
  if (!orgs || orgs.length === 0) return { isAdmin: true, rows: [] };

  const { data: members } = await supabase
    .from("organization_members")
    .select("organization_id")
    .in("organization_id", orgs.map((o) => o.id))
    .returns<{ organization_id: string }[]>();
  const countByOrg = new Map<string, number>();
  for (const m of members ?? []) countByOrg.set(m.organization_id, (countByOrg.get(m.organization_id) ?? 0) + 1);

  // Isolated defensive query (migration 0090 may not have run yet) — kept
  // separate from the base org query above so a missing column/table only
  // costs this one field (budgets show as unlimited/$0 until the migration
  // runs) instead of blanking the entire admin org table.
  const budgetByOrg = new Map<string, number | null>();
  const { data: budgets, error: budgetsError } = await supabase
    .from("organizations")
    .select("id, monthly_ai_budget_usd")
    .in("id", orgs.map((o) => o.id))
    .returns<{ id: string; monthly_ai_budget_usd: number | null }[]>();
  if (budgetsError) {
    console.error("Could not read monthly_ai_budget_usd — migration 0090 may not be run yet:", budgetsError);
  }
  for (const b of budgets ?? []) budgetByOrg.set(b.id, b.monthly_ai_budget_usd);

  // One RPC call per org (this app has no service-role key, so there's no
  // single aggregate query across orgs here either — same posture as the
  // per-org member count above). Isolated per-org so one org's spend query
  // failing (e.g. migration 0090 not yet run) doesn't blank the whole table.
  const spendByOrg = new Map<string, number>();
  await Promise.all(
    orgs.map(async (o) => {
      const { data } = await supabase.rpc("org_ai_spend_this_month", { target_org_id: o.id });
      spendByOrg.set(o.id, data == null ? 0 : Number(data));
    })
  );

  const rows: AdminOrganizationRow[] = orgs.map((o) => ({
    id: o.id,
    name: o.name,
    memberCount: countByOrg.get(o.id) ?? 0,
    seatLimit: o.seat_limit,
    monthlyAiBudgetUsd: budgetByOrg.get(o.id) ?? null,
    spendThisMonthUsd: spendByOrg.get(o.id) ?? 0,
    isDisabled: o.is_disabled ?? false,
    pendingDeletionAt: o.pending_deletion_at,
  }));

  return { isAdmin: true, rows };
}

// null clears the limit back to unlimited.
export async function updateOrgSeatLimit(organizationId: string, seatLimit: number | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single<{ is_admin: boolean }>();
  if (!ownProfile?.is_admin) return { error: "Not authorized" };

  if (seatLimit !== null && (!Number.isInteger(seatLimit) || seatLimit < 0)) {
    return { error: "Seat limit must be a whole number, or blank for unlimited" };
  }

  const { error } = await supabase
    .from("organizations")
    .update({ seat_limit: seatLimit })
    .eq("id", organizationId);
  if (error) {
    console.error("updateOrgSeatLimit failed:", error);
    return { error: "Could not update — the database may need migration 0079 run first." };
  }

  revalidatePath("/dashboard/admin");
  return { success: true };
}

// Blocks/restores every member of a company workspace at once — enterprise
// has no "free" fallback tier the way individual accounts do (Enterprise is
// Custom/sales-priced, no self-serve downgrade path), so a lapsed payment
// can't be handled by downgrading like the LemonSqueezy webhook does for
// individuals. Manual only for now: enterprise deals are sold via "Talk to
// sales" (invoiced, not a self-serve subscription), so there's no billing
// webhook to react to automatically yet.
export async function setOrganizationDisabled(organizationId: string, disabled: boolean): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single<{ is_admin: boolean }>();
  if (!ownProfile?.is_admin) return { error: "Not authorized" };

  const { error } = await supabase.from("organizations").update({ is_disabled: disabled }).eq("id", organizationId);
  if (error) {
    console.error("setOrganizationDisabled failed:", error);
    return { error: "Could not update — the database may need migration 0113 run first." };
  }

  revalidatePath("/dashboard/admin");
  return { success: true };
}

export type OrgMemberSpendRow = {
  userId: string;
  name: string;
  email: string;
  spendThisMonthUsd: number;
};

// Platform-admin-only, per-employee breakdown within one company — never
// exposed to the company's own org-admin or its employees (see migration
// 0093's comment: customers only ever see an abstracted "credit" concept,
// never real dollar figures or a colleague's usage). The RPC itself is
// also gated by is_admin() internally, so this is defense-in-depth, not
// the only guard.
export async function getOrgMemberAiSpend(organizationId: string): Promise<{ isAdmin: boolean; rows: OrgMemberSpendRow[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { isAdmin: false, rows: [] };

  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single<{ is_admin: boolean }>();
  if (!ownProfile?.is_admin) return { isAdmin: false, rows: [] };

  const { data: members } = await supabase
    .from("organization_members")
    .select("user_id, profiles(full_name, email)")
    .eq("organization_id", organizationId)
    .returns<{ user_id: string; profiles: { full_name: string | null; email: string | null } }[]>();
  if (!members || members.length === 0) return { isAdmin: true, rows: [] };

  const { data: spend, error } = await supabase.rpc("org_member_ai_spend_this_month", { target_org_id: organizationId });
  if (error) {
    console.error("getOrgMemberAiSpend failed — migration 0093 may not be run yet:", error);
  }
  const spendByUser = new Map<string, number>();
  for (const s of (spend ?? []) as { user_id: string; cost_usd: number }[]) {
    spendByUser.set(s.user_id, Number(s.cost_usd));
  }

  const rows: OrgMemberSpendRow[] = members
    .map((m) => ({
      userId: m.user_id,
      name: m.profiles?.full_name ?? "—",
      email: m.profiles?.email ?? "—",
      spendThisMonthUsd: spendByUser.get(m.user_id) ?? 0,
    }))
    .sort((a, b) => b.spendThisMonthUsd - a.spendThisMonthUsd);

  return { isAdmin: true, rows };
}

// null clears the budget back to unlimited. Raising it is exactly how a
// platform admin "adds more credits" to a client mid-month — there's no
// separate top-up action, just a new number.
export async function updateOrgAiBudget(organizationId: string, budgetUsd: number | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single<{ is_admin: boolean }>();
  if (!ownProfile?.is_admin) return { error: "Not authorized" };

  if (budgetUsd !== null && (!Number.isFinite(budgetUsd) || budgetUsd < 0)) {
    return { error: "Budget must be a non-negative number, or blank for unlimited" };
  }

  const { error } = await supabase
    .from("organizations")
    .update({ monthly_ai_budget_usd: budgetUsd })
    .eq("id", organizationId);
  if (error) {
    console.error("updateOrgAiBudget failed:", error);
    return { error: "Could not update — the database may need migration 0090 run first." };
  }

  revalidatePath("/dashboard/admin");
  return { success: true };
}

async function isPlatformAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("is_admin").eq("id", userId).single<{ is_admin: boolean }>();
  return data?.is_admin ?? false;
}

// Provisions a company workspace from the backend and hands it to the
// company's real admin via a pre-authorized invite (migration 0081) — the
// platform admin never becomes a member of the org themselves, since this
// app has no service-role key to create someone else's login directly.
export async function createCompanyWorkspace(fields: {
  name: string;
  adminEmail: string;
  seatLimit: number | null;
  website?: string;
  industry?: string;
  employeeCount?: string;
}): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!(await isPlatformAdmin(supabase, user.id))) return { error: "Not authorized" };

  const name = fields.name.trim();
  if (!name) return { error: "Company name is required" };
  const adminEmail = fields.adminEmail.trim().toLowerCase();
  if (!adminEmail || !adminEmail.includes("@")) return { error: "A valid admin email is required" };
  if (fields.seatLimit !== null && (!Number.isInteger(fields.seatLimit) || fields.seatLimit < 0)) {
    return { error: "Seat limit must be a whole number, or blank for unlimited" };
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name,
      slug: slugify(name),
      created_by: user.id,
      seat_limit: fields.seatLimit,
      website: fields.website?.trim() || null,
      industry: fields.industry?.trim() || null,
      employee_count: fields.employeeCount?.trim() || null,
    })
    .select()
    .single<{ id: string }>();
  if (orgError || !org) {
    console.error("createCompanyWorkspace org insert failed:", orgError);
    return { error: "Could not create the company workspace — the database may need migration 0081 run first." };
  }

  const { error: inviteError } = await supabase.from("organization_invites").insert({
    organization_id: org.id,
    email: adminEmail,
    invited_by: user.id,
    intended_role: "admin",
  });
  if (inviteError) {
    console.error("createCompanyWorkspace invite insert failed:", inviteError);
    return { error: "Workspace created, but the founding-admin invite failed — try inviting them again from the company page." };
  }

  try {
    await sendEmail(
      adminEmail,
      `You've been set up as the admin for ${name} on Devometrics`,
      renderEmail({
        preheader: `${name} is ready on Devometrics — you're its admin`,
        bodyHtml: `
          <h2 style="color:#16161a;font-size:20px;margin:0 0 16px;">Your company workspace is ready</h2>
          <p style="font-size:15px;line-height:1.7;margin:0 0 24px;">
            Devometrics has set up <strong>${escapeHtml(name)}</strong>'s workspace and made
            <strong>${escapeHtml(adminEmail)}</strong> its admin.
          </p>
          <p style="margin:0;">
            <a href="https://devometrics.com/signup?email=${encodeURIComponent(adminEmail)}" style="background:#3f7a67;color:#16161a;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;display:inline-block;font-size:14px;">Create your admin account →</a>
          </p>
          <p style="font-size:13px;color:#8892a4;margin:24px 0 0;">
            Sign up with this email address (${escapeHtml(adminEmail)}) and you'll be attached as
            ${escapeHtml(name)}'s admin automatically.
          </p>
        `,
      })
    );
  } catch (err) {
    console.error(`Founding-admin invite email failed for ${adminEmail}:`, err);
  }

  revalidatePath("/dashboard/admin");
  return { success: true };
}

// Platform-wide equivalent of deleteOrganization (lib/organizations/actions.ts),
// which only works when the caller is that specific org's own admin. Goes
// through the platform_admin_schedule_organization_deletion RPC (migration
// 0119), gated by the caller's own is_admin flag — same 30-day grace
// period and daily purge cron (purge_scheduled_organization_deletions,
// migration 0059) as every other path into this deletion mechanism, so a
// mistaken click is still recoverable via cancel within the window.
export async function platformAdminScheduleOrganizationDeletion(
  organizationId: string
): Promise<{ error: string } | { success: true; deletionAt: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase.rpc("platform_admin_schedule_organization_deletion", {
    target_org_id: organizationId,
    grace_days: 30,
  });
  if (error) {
    console.error("platformAdminScheduleOrganizationDeletion failed:", error);
    return { error: "Could not schedule deletion — the database may need migration 0119 run first." };
  }

  revalidatePath("/dashboard/admin");
  return { success: true, deletionAt: data as string };
}

export async function platformAdminCancelOrganizationDeletion(organizationId: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.rpc("platform_admin_cancel_organization_deletion", { target_org_id: organizationId });
  if (error) {
    console.error("platformAdminCancelOrganizationDeletion failed:", error);
    return { error: "Could not cancel — try again." };
  }

  revalidatePath("/dashboard/admin");
  return { success: true };
}
