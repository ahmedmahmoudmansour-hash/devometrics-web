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
    .select("id, name, seat_limit")
    .order("name", { ascending: true })
    .returns<{ id: string; name: string; seat_limit: number | null }[]>();
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
          <h2 style="color:#0A0F1E;font-size:20px;margin:0 0 16px;">Your company workspace is ready</h2>
          <p style="font-size:15px;line-height:1.7;margin:0 0 24px;">
            Devometrics has set up <strong>${escapeHtml(name)}</strong>'s workspace and made
            <strong>${escapeHtml(adminEmail)}</strong> its admin.
          </p>
          <p style="margin:0;">
            <a href="https://devometrics.com/signup?email=${encodeURIComponent(adminEmail)}" style="background:#00C9A7;color:#0A0F1E;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;display:inline-block;font-size:14px;">Create your admin account →</a>
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
