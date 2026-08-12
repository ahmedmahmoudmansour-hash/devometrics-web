"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { renderEmail, escapeHtml, customMessageHtml } from "@/lib/email/template";
import { getEmailMessageOverride } from "@/lib/organizations/emailMessages";
import { buildEmployeeDetail, buildCompanyData } from "@/lib/organizations/aggregate";
import { slugify } from "@/lib/organizations/slug";
import { ENGLISH_PROFICIENCY_SLUG, cefrLevelFromScore } from "@/lib/assessments/englishProficiency";
import { COGNITIVE_ABILITY_SLUG, cognitiveBandFromScore } from "@/lib/assessments/cognitiveAbility";
import { BIG_FIVE_TRAITS, bigFiveInterpretation } from "@/lib/personality/bigFive";
import { runHireWelcome, runHireToProbation } from "@/lib/automations/recipes";
import { assertAiBudgetOk, recordAiUsage } from "@/lib/aiUsage/track";
import { resolveAssignableName } from "@/lib/assessments/assignableCatalog";
import type { OrganizationInvite, OrganizationMember } from "@/lib/supabase/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Best-effort — a failed invite email shouldn't fail the invite itself
// (the row in organization_invites is still the source of truth; the
// person is auto-attached the moment they sign up with that email either
// way, per checkAndConsumeInvite below).
// Exported so lib/hiring/hireActions.ts can reuse this exact email template
// for hire-conversion invites rather than building a second one.
export async function sendInviteEmail(email: string, orgName: string, organizationId: string): Promise<void> {
  try {
    const override = await getEmailMessageOverride(organizationId, "employee_invite");
    await sendEmail(
      email,
      override.subject || `You've been invited to join ${orgName} on Devometrics`,
      renderEmail({
        preheader: `${orgName} invited you to Devometrics`,
        bodyHtml: `
          <h2 style="color:#0A0F1E;font-size:20px;margin:0 0 16px;">You're invited</h2>
          ${customMessageHtml(override.message)}
          <p style="font-size:15px;line-height:1.7;margin:0 0 24px;">
            <strong>${escapeHtml(orgName)}</strong> has invited you to join their workspace on
            Devometrics — track your career growth alongside the rest of your team.
          </p>
          <p style="margin:0;">
            <a href="https://devometrics.com/signup?email=${encodeURIComponent(email)}" style="background:#00C9A7;color:#0A0F1E;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;display:inline-block;font-size:14px;">Create your account →</a>
          </p>
          <p style="font-size:13px;color:#8892a4;margin:24px 0 0;">
            Sign up with this email address (${escapeHtml(email)}) and you'll be attached to
            ${escapeHtml(orgName)} automatically — no separate invite code needed.
          </p>
        `,
      })
    );
  } catch (err) {
    console.error(`Invite email failed for ${email}:`, err);
  }
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

// How many manager-hops up the Org Chart get read + co-sign access on an
// Impact Cycle review, beyond the direct manager (who always has full
// access regardless of this setting). Each company picks its own depth —
// deliberately not a fixed number, since how many layers of management
// should see a review varies a lot by company size and culture.
export async function updateReviewEscalationLevels(organizationId: string, levels: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!Number.isInteger(levels) || levels < 1 || levels > 10) {
    return { error: "Escalation levels must be a whole number between 1 and 10" };
  }

  const { error } = await supabase
    .from("organizations")
    .update({ review_escalation_levels: levels })
    .eq("id", organizationId);
  if (error) {
    console.error("updateReviewEscalationLevels failed:", error);
    return { error: "Could not update — the database may need migration 0082 run first." };
  }

  revalidatePath("/dashboard/company/impact-cycles");
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
  country?: string,
  managerName?: string,
  managerEmail?: string,
  businessUnit?: string,
  location?: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) return { error: "A valid email is required" };

  // Friendly, early error — the real enforcement is the RLS insert policy
  // on organization_members (org_seat_limit_ok, migration 0079), which
  // still blocks the join even if this check is somehow bypassed. This just
  // means an admin finds out at invite time, not after the employee tries
  // to sign up and quietly fails.
  const { data: org } = await supabase
    .from("organizations")
    .select("name, seat_limit")
    .eq("id", organizationId)
    .maybeSingle<{ name: string; seat_limit: number | null }>();
  if (org?.seat_limit !== null && org?.seat_limit !== undefined) {
    const { count } = await supabase
      .from("organization_members")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId);
    if ((count ?? 0) >= org.seat_limit) {
      return { error: `This workspace is at its seat limit (${org.seat_limit}) — contact Devometrics to add more seats.` };
    }
  }

  const { error } = await supabase.from("organization_invites").insert({
    organization_id: organizationId,
    email: trimmed,
    invited_by: user.id,
    title: title?.trim() || null,
    department: department?.trim() || null,
    country: country?.trim() || null,
    manager_name: managerName?.trim() || null,
    manager_email: managerEmail?.trim() || null,
    business_unit: businessUnit?.trim() || null,
    location: location?.trim() || null,
  });
  if (error) return { error: "Could not send invite — they may already be invited" };

  if (org?.name) await sendInviteEmail(trimmed, org.name, organizationId);

  revalidatePath("/dashboard/company");
  return { success: true };
}

export type BulkInviteRow = {
  email: string;
  title?: string;
  department?: string;
  country?: string;
  managerName?: string;
  managerEmail?: string;
  businessUnit?: string;
  location?: string;
};

export type BulkInviteResult = { email: string; status: "invited" | "duplicate" | "invalid" };

// Cap kept small enough that the sequential-fallback path below (needed
// when the batch insert hits a duplicate) and the concurrent email sends
// both stay comfortably inside a serverless function's execution window —
// generous for a single company's real headcount, not meant for
// cross-company data loads.
const MAX_BULK_IMPORT_ROWS = 200;

export async function bulkInviteEmployees(
  organizationId: string,
  rows: BulkInviteRow[]
): Promise<{ error?: string; results?: BulkInviteResult[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!Array.isArray(rows) || rows.length === 0) return { error: "No rows to import" };
  if (rows.length > MAX_BULK_IMPORT_ROWS) {
    return { error: `Import is limited to ${MAX_BULK_IMPORT_ROWS} rows at a time — split into smaller files.` };
  }

  const results: BulkInviteResult[] = [];
  const validRows: { row: BulkInviteRow; email: string }[] = [];
  for (const row of rows) {
    const email = row.email?.trim().toLowerCase() ?? "";
    if (!email || !email.includes("@")) {
      results.push({ email: row.email?.trim() || "(blank)", status: "invalid" });
      continue;
    }
    validRows.push({ row, email });
  }
  if (validRows.length === 0) return { results };

  const toInsert = (row: BulkInviteRow, email: string) => ({
    organization_id: organizationId,
    email,
    invited_by: user.id,
    title: row.title?.trim() || null,
    department: row.department?.trim() || null,
    country: row.country?.trim() || null,
    manager_name: row.managerName?.trim() || null,
    manager_email: row.managerEmail?.trim() || null,
    business_unit: row.businessUnit?.trim() || null,
    location: row.location?.trim() || null,
  });

  const { error: batchError } = await supabase
    .from("organization_invites")
    .insert(validRows.map(({ row, email }) => toInsert(row, email)));

  if (batchError) {
    // A single bulk insert either fully succeeds or fully fails (e.g. one
    // row re-inviting an already-invited email violates the unique
    // constraint and aborts the whole batch) — fall back to inserting one
    // row at a time so a handful of duplicates don't block everyone else
    // in the file.
    for (const { row, email } of validRows) {
      const { error } = await supabase.from("organization_invites").insert(toInsert(row, email));
      results.push({ email, status: error ? "duplicate" : "invited" });
    }
  } else {
    for (const { email } of validRows) results.push({ email, status: "invited" });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .maybeSingle<{ name: string }>();
  if (org?.name) {
    const invited = results.filter((r) => r.status === "invited");
    await Promise.allSettled(invited.map((r) => sendInviteEmail(r.email, org.name, organizationId)));
  }

  revalidatePath("/dashboard/company");
  return { results };
}

// RLS decides who's actually allowed to delete which row — org admins via
// 0017's is_org_admin-scoped policy, platform admins via 0081's is_admin()
// one that covers every organization. Both the company page and the
// platform admin page call this same action, so both get revalidated
// rather than picking one and leaving the other stale.
export async function revokeInvite(inviteId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("organization_invites").delete().eq("id", inviteId);
  revalidatePath("/dashboard/company");
  revalidatePath("/dashboard/admin");
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

  const { data: invite, error: inviteError } = await supabase
    .from("organization_invites")
    .select("*")
    .is("accepted_at", null)
    .ilike("email", user.email)
    .maybeSingle<OrganizationInvite>();
  if (inviteError) {
    console.error(`checkAndConsumeInvite: lookup failed for ${user.email}:`, inviteError);
    return false;
  }
  if (!invite) return false;

  const { error: memberError } = await supabase.from("organization_members").insert({
    organization_id: invite.organization_id,
    user_id: user.id,
    role: invite.intended_role ?? "member",
    title: invite.title ?? null,
    department: invite.department ?? null,
    country: invite.country ?? null,
    manager_name: invite.manager_name ?? null,
    manager_email: invite.manager_email ?? null,
    business_unit: invite.business_unit ?? null,
    location: invite.location ?? null,
  });
  if (memberError) {
    console.error(`checkAndConsumeInvite: insert failed for ${user.email} into org ${invite.organization_id}:`, memberError);
    return false;
  }

  // Hire-conversion seeding (migration 0088, Smart Hiring): if this invite
  // came from markCandidateHired(), give the new employee's first Gap
  // Analysis a head start from the CV competency score already computed
  // during hiring, instead of starting empty. Readable here via a narrow
  // RLS policy that matches the invite's own verified email — see the
  // migration for details. Best-effort: no CV score (e.g. a manually-added
  // pipeline card with no CV run) just silently no-ops, same as any other
  // freshly-invited employee today.
  if (invite.candidate_id) {
    const { data: cvScore } = await supabase
      .from("hiring_candidate_cv_scores")
      .select("target_role, job_description, cv_text, competencies, career_health_score")
      .eq("candidate_id", invite.candidate_id)
      .maybeSingle<{
        target_role: string;
        job_description: string;
        cv_text: string;
        competencies: unknown;
        career_health_score: number;
      }>();
    if (cvScore) {
      const { error: seedError } = await supabase.from("gap_analyses").insert({
        user_id: user.id,
        target_role: cvScore.target_role,
        job_description: cvScore.job_description,
        cv_text: cvScore.cv_text,
        competencies: cvScore.competencies,
        career_health_score: cvScore.career_health_score,
      });
      if (seedError) {
        console.error(`checkAndConsumeInvite: gap_analyses seed failed for ${user.email}:`, seedError);
      }
    }
  }

  await supabase.from("organization_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);

  // Broadened 2026-08-03 (per the strategic memo's Onboarding review) to
  // fire for every invite-based join, not just genuine Smart Hiring
  // conversions (invite.candidate_id set) as it did before — someone
  // joining a company workspace via a direct admin invite is still
  // genuinely starting there, and now gets the org's new-hire-flagged
  // Knowledge Hub content (migration 0120) rather than nothing.
  {
    const [{ data: org }, { data: profile }] = await Promise.all([
      supabase.from("organizations").select("name").eq("id", invite.organization_id).maybeSingle<{ name: string }>(),
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle<{ full_name: string | null }>(),
    ]);
    await runHireWelcome(supabase, {
      organizationId: invite.organization_id,
      employeeUserId: user.id,
      employeeName: profile?.full_name || user.email,
      orgName: org?.name ?? "your new workspace",
      managerEmail: invite.manager_email ?? null,
    });
    await runHireToProbation(supabase, {
      organizationId: invite.organization_id,
      employeeUserId: user.id,
      employeeName: profile?.full_name || user.email,
    });
  }

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
// Best-effort — mirrors sendKnowledgeHubAssignmentEmail's posture, a
// failed notification shouldn't undo the assignment. Looks up the
// EMPLOYEE's own org membership rather than the assigner's — the assigner
// may be a manager who isn't an org admin, so their own org context isn't
// necessarily what should drive the email's branding/override.
async function sendMilestoneAssignmentEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  employeeUserId: string,
  milestoneTitle: string,
  targetDate: string | null
): Promise<void> {
  const { data: member } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", employeeUserId)
    .maybeSingle<{ organization_id: string }>();
  if (!member?.organization_id) return;

  const [{ data: org }, { data: profile }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", member.organization_id).maybeSingle<{ name: string }>(),
    supabase.from("profiles").select("email, full_name").eq("id", employeeUserId).maybeSingle<{ email: string | null; full_name: string | null }>(),
  ]);
  if (!org?.name || !profile?.email) return;

  try {
    const override = await getEmailMessageOverride(member.organization_id, "milestone_assignment");
    await sendEmail(
      profile.email,
      override.subject || `${org.name} assigned you a new goal on Devometrics`,
      renderEmail({
        preheader: `${milestoneTitle}${targetDate ? ` — due ${targetDate}` : ""}`,
        footerNote: "You're getting this because your organization assigned you a goal on Devometrics.",
        bodyHtml: `
          <h2 style="color:#0A0F1E;font-size:20px;margin:0 0 16px;">New goal assigned</h2>
          ${customMessageHtml(override.message)}
          <p style="font-size:15px;line-height:1.7;margin:0 0 8px;">
            <strong>${escapeHtml(org.name)}</strong> assigned you <strong>${escapeHtml(milestoneTitle)}</strong> on Devometrics.
          </p>
          ${
            targetDate
              ? `<p style="font-size:13px;color:#8892a4;margin:0 0 24px;">Due by ${escapeHtml(targetDate)}</p>`
              : `<p style="margin:0 0 24px;"></p>`
          }
          <p style="margin:0;">
            <a href="https://devometrics.com/dashboard/plans" style="background:#00C9A7;color:#0A0F1E;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;display:inline-block;font-size:14px;">Open your plan →</a>
          </p>
        `,
      })
    );
  } catch (err) {
    console.error(`Milestone assignment email failed for ${profile.email}:`, err);
  }
}

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

  await sendMilestoneAssignmentEmail(supabase, employeeUserId, title, fields.targetDate ?? null);

  revalidatePath(`/dashboard/company/${employeeUserId}`);
  revalidatePath("/dashboard/company/employees");
  return { success: true };
}

// Bulk variant of assignTaskToEmployee — same milestone-per-employee shape
// (each employee has their own development plan, resolved or lazily
// created), so this just loops the existing single-employee action rather
// than reinventing plan resolution or the milestone-assignment email.
// Runs in parallel and reports how many actually succeeded rather than
// failing the whole batch if one employee's row has a problem — same
// "partial success is still useful" posture as bulkInviteEmployees.
export async function bulkAssignMilestone(
  employeeUserIds: string[],
  fields: { title: string; description?: string; targetDate?: string }
): Promise<{ success: true; assigned: number } | { error: string }> {
  if (employeeUserIds.length === 0) return { error: "Select at least one employee" };
  const title = fields.title.trim();
  if (!title) return { error: "Goal title is required" };

  const results = await Promise.all(
    employeeUserIds.map((employeeUserId) => assignTaskToEmployee(employeeUserId, null, { ...fields, title }))
  );
  const assigned = results.filter((r) => "success" in r).length;
  if (assigned === 0) return { error: "Could not assign — try again" };

  revalidatePath("/dashboard/company/employees");
  return { success: true, assigned };
}

// Same posture as sendMilestoneAssignmentEmail right above — best-effort,
// never blocks the underlying assignment, looks up the EMPLOYEE's own org
// membership (not the assigner's) so the email's branding/override always
// matches who's receiving it.
async function sendAssessmentAssignmentEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  employeeUserId: string,
  assessmentSlug: string,
  dueDate: string | null
): Promise<void> {
  const { data: member } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", employeeUserId)
    .maybeSingle<{ organization_id: string }>();
  if (!member?.organization_id) return;

  const [{ data: org }, { data: profile }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", member.organization_id).maybeSingle<{ name: string }>(),
    supabase.from("profiles").select("email, full_name").eq("id", employeeUserId).maybeSingle<{ email: string | null; full_name: string | null }>(),
  ]);
  if (!org?.name || !profile?.email) return;

  const assessmentTitle = resolveAssignableName(assessmentSlug);

  try {
    const override = await getEmailMessageOverride(member.organization_id, "assessment_assignment");
    await sendEmail(
      profile.email,
      override.subject || `${org.name} assigned you a new assessment on Devometrics`,
      renderEmail({
        preheader: `${assessmentTitle}${dueDate ? ` — due ${dueDate}` : ""}`,
        footerNote: "You're getting this because your organization assigned you an assessment on Devometrics.",
        bodyHtml: `
          <h2 style="color:#0A0F1E;font-size:20px;margin:0 0 16px;">New assessment assigned</h2>
          ${customMessageHtml(override.message)}
          <p style="font-size:15px;line-height:1.7;margin:0 0 8px;">
            <strong>${escapeHtml(org.name)}</strong> assigned you <strong>${escapeHtml(assessmentTitle)}</strong> on Devometrics.
          </p>
          ${
            dueDate
              ? `<p style="font-size:13px;color:#8892a4;margin:0 0 24px;">Due by ${escapeHtml(dueDate)}</p>`
              : `<p style="margin:0 0 24px;"></p>`
          }
          <p style="margin:0;">
            <a href="https://devometrics.com/dashboard/assessments" style="background:#00C9A7;color:#0A0F1E;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;display:inline-block;font-size:14px;">Open your assessments →</a>
          </p>
        `,
      })
    );
  } catch (err) {
    console.error(`Assessment assignment email failed for ${profile.email}:`, err);
  }
}

export async function assignAssessment(employeeUserId: string, assessmentSlug: string, dueDate?: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("assigned_assessments").insert({
    employee_user_id: employeeUserId,
    assessment_slug: assessmentSlug,
    assigned_by: user.id,
    due_date: dueDate || null,
  });
  if (error) {
    // Unique constraint violation (already assigned) shouldn't read as a
    // real failure to the admin — same "already assigned" intent either way.
    if (error.code === "23505") return { error: "Already assigned to this person." };
    return { error: "Could not assign — the database may need migration 0058 run first." };
  }

  await sendAssessmentAssignmentEmail(supabase, employeeUserId, assessmentSlug, dueDate ?? null);

  revalidatePath(`/dashboard/company/${employeeUserId}`);
  return { success: true };
}

// Bulk variant of assignAssessment — one assessment pushed to several
// specific employees at once, from the Employees table's multi-select
// toolbar. Diffs out who already has this assessment BEFORE upserting
// (same pattern as assignKnowledgeHubContent, lib/knowledgeHub/actions.ts)
// so the assignment-notice email only ever reaches genuinely newly-assigned
// people — one separate email per recipient, never a combined digest, and
// never a repeat notice to someone re-selected who was already assigned.
// Upsert still covers everyone with ignoreDuplicates (same pattern as
// before) so RLS (is_org_admin_of_user) gates each row individually — a
// stray id for someone outside the admin's org simply fails to insert, not
// the whole batch.
export async function bulkAssignAssessment(
  employeeUserIds: string[],
  assessmentSlug: string,
  dueDate?: string | null
): Promise<{ success: true; assigned: number } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (employeeUserIds.length === 0) return { error: "Select at least one employee" };

  const { data: existing } = await supabase
    .from("assigned_assessments")
    .select("employee_user_id")
    .eq("assessment_slug", assessmentSlug)
    .in("employee_user_id", employeeUserIds)
    .returns<{ employee_user_id: string }[]>();
  const alreadyAssigned = new Set((existing ?? []).map((r) => r.employee_user_id));
  const newlyAssignedIds = employeeUserIds.filter((id) => !alreadyAssigned.has(id));

  const { error } = await supabase.from("assigned_assessments").upsert(
    employeeUserIds.map((employeeUserId) => ({
      employee_user_id: employeeUserId,
      assessment_slug: assessmentSlug,
      assigned_by: user.id,
      due_date: dueDate || null,
    })),
    { onConflict: "employee_user_id,assessment_slug", ignoreDuplicates: true }
  );
  if (error) return { error: "Could not assign — the database may need migration 0058 run first." };

  if (newlyAssignedIds.length > 0) {
    await Promise.allSettled(
      newlyAssignedIds.map((employeeUserId) =>
        sendAssessmentAssignmentEmail(supabase, employeeUserId, assessmentSlug, dueDate ?? null)
      )
    );
  }

  for (const employeeUserId of employeeUserIds) revalidatePath(`/dashboard/company/${employeeUserId}`);
  revalidatePath("/dashboard/company/employees");
  return { success: true, assigned: newlyAssignedIds.length };
}

export async function removeAssignedAssessment(employeeUserId: string, assessmentSlug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  await supabase
    .from("assigned_assessments")
    .delete()
    .eq("employee_user_id", employeeUserId)
    .eq("assessment_slug", assessmentSlug);

  revalidatePath(`/dashboard/company/${employeeUserId}`);
  return { success: true };
}

const ASSESSMENT_SUMMARY_TOOL = {
  name: "record_assessment_summary",
  description: "Write a professional assessment-report narrative for one employee, grounded strictly in their measured data.",
  input_schema: {
    type: "object" as const,
    properties: {
      overallSummary: {
        type: "string",
        description:
          "2-4 sentence executive summary in a professional assessment-report tone — an analyst's read of where this person stands overall, citing their actual scores. No generic praise; every claim traces to the data provided.",
      },
      keyStrengths: {
        type: "array",
        items: { type: "string" },
        maxItems: 4,
        description: "Their strongest measured evidence, each citing a specific score or result.",
      },
      developmentPriorities: {
        type: "array",
        items: { type: "string" },
        maxItems: 4,
        description: "Specific, actionable development priorities grounded in their actual gaps — not generic advice.",
      },
      standingNote: {
        type: "string",
        description:
          "1-2 sentences on how they compare to their team's measured averages — where they're above, at, or below. If team benchmark data is too thin, say so instead of guessing.",
      },
    },
    required: ["overallSummary", "keyStrengths", "developmentPriorities", "standingNote"],
  },
};

// Generates the narrative that turns the employee report from a chart dump
// into something that reads like a real assessment-center writeup. Cached
// in employee_assessment_summaries (migration 0062) and regenerated only
// on request — this is a real Claude call, not something to run on every
// page view or PDF export.
export async function generateEmployeeAssessmentSummary(employeeUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const detail = await buildEmployeeDetail(employeeUserId);
  if (!detail.isAuthorized || !detail.profile) return { error: "Not authorized" };

  if (!detail.gapAnalysis && detail.assessmentResults.length === 0 && detail.resumeScore === null) {
    return { error: "No measured data yet — this person hasn't run a Gap Analysis, taken an assessment, or analyzed a resume." };
  }

  // If you specifically assigned assessments for this person, the summary
  // should wait for those — generating it against a partial picture (some
  // assigned assessments still outstanding) would read as complete when
  // it isn't. Doesn't block people with no assignments at all, since not
  // every employee goes through a formal assignment.
  const pending = detail.assignedAssessments.filter((a) => !a.completed);
  if (pending.length > 0) {
    return {
      error: `${pending.length} assigned assessment${pending.length === 1 ? "" : "s"} still pending (${pending.map((a) => a.name).join(", ")}) — wait until these are complete for an accurate summary.`,
    };
  }

  const dimensionLines = (detail.gapAnalysis?.competencies ?? [])
    .map((c) => {
      const avg = detail.orgDimensionAverages[c.dimension];
      return `${c.dimension}: ${c.currentLevel}/100${avg !== undefined ? ` (team average: ${avg})` : ""}`;
    })
    .join("\n");

  const assessmentLines =
    detail.assessmentResults
      .map((a) =>
        a.slug === ENGLISH_PROFICIENCY_SLUG
          ? `${a.name}: CEFR ${cefrLevelFromScore(a.score)} (${a.score}/100 correct — objective test, not self-report)`
          : a.slug === COGNITIVE_ABILITY_SLUG
          ? `${a.name}: ${cognitiveBandFromScore(a.score)} (${a.score}/100 correct — self-development reasoning exercise, not a validated selection instrument; do not treat as a fitness or intelligence judgment)`
          : `${a.name}: ${a.score}/100`
      )
      .join("\n") || "(none completed)";

  // Only ever passed as pre-vetted, work-neutral interpretation sentences
  // (bigFiveInterpretation), never raw trait scores — keeps the model from
  // freely editorializing about someone's personality. Only present at all
  // if the employee opted in (migration 0065); detail.bigFive is null
  // otherwise, same as if they'd never taken it.
  const bigFiveLines = detail.bigFive
    ? BIG_FIVE_TRAITS.map((trait) => `${trait}: ${bigFiveInterpretation(trait, detail.bigFive!.scores[trait])}`).join("\n")
    : null;

  // Direct management input (migration 0068), optional — unlike Big
  // Five/Cognitive Reasoning above, a performance rating and manager notes
  // ARE legitimately relevant to a talent report; they're just
  // single-source and subjective, so the framing asks the model to weigh
  // them as one input rather than treat a single manager's opinion as
  // settled fact.
  const performanceLine = detail.performanceRating
    ? `${detail.performanceRating}/5${detail.performanceRatingNote ? ` — "${detail.performanceRatingNote}"` : ""}`
    : null;
  const managerNoteLines = detail.managerNotes
    .slice(0, 5)
    .map((n) => `- (${new Date(n.created_at).toLocaleDateString()}) ${n.authorName}: ${n.note}`)
    .join("\n");

  const prompt = [
    `EMPLOYEE: ${detail.profile.name}${detail.profile.title ? `, ${detail.profile.title}` : ""}`,
    detail.gapAnalysis
      ? `\nCAREER HEALTH SCORE: ${detail.gapAnalysis.careerHealthScore}/100${detail.orgCareerHealthScore !== null ? ` (team average: ${detail.orgCareerHealthScore})` : ""}, scored against target role "${detail.gapAnalysis.targetRole}"`
      : "\nCAREER HEALTH SCORE: not available — no Gap Analysis run yet",
    dimensionLines ? `\nMEASURED COMPETENCIES:\n${dimensionLines}` : "",
    `\nRESUME INTELLIGENCE SCORE: ${detail.resumeScore ?? "not available"}`,
    `\nASSESSMENTS COMPLETED:\n${assessmentLines}`,
    `\nDEVELOPMENT PLAN PROGRESS: ${detail.plans.reduce((a, p) => a + p.milestones.filter((m) => m.completed).length, 0)}/${detail.plans.reduce((a, p) => a + p.milestones.length, 0)} milestones complete across ${detail.plans.length} plan(s)`,
    bigFiveLines
      ? `\nWORKING STYLE (Big Five, self-reported, shared voluntarily by the employee — use only for how-to-coach framing, never as a strength/weakness or suitability judgment):\n${bigFiveLines}`
      : "",
    performanceLine
      ? `\nMANAGER PERFORMANCE RATING (single-source, manager-reported — one input among several, not independently verified): ${performanceLine}`
      : "",
    managerNoteLines
      ? `\nRECENT MANAGER NOTES (qualitative, single-source context — most recent first):\n${managerNoteLines}`
      : "",
  ].join("\n");

  const membership = await getMyOrganizationMembership();
  const organizationId = membership?.organization_id ?? null;
  const budgetCheck = await assertAiBudgetOk(supabase, { organizationId, userId: user.id });
  if (budgetCheck.error) return { error: budgetCheck.error };

  let summary: { overallSummary: string; keyStrengths: string[]; developmentPriorities: string[]; standingNote: string };
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1500,
      system:
        "You write professional assessment-report narratives for Devometrics' enterprise talent platform, read by HR and people managers. This is decision support, not a verdict — ground every claim strictly in the measured data provided, never invent scores, tenure, or performance history that isn't given. Where data is thin (few or no assessments run), say so plainly rather than filling the gap with generic praise. Do not consider or mention age, gender, nationality, or anything other than the competency evidence provided. If working-style/Big Five context is given, use it only to suggest how someone might prefer to be coached or what kind of assignments might suit their style — never as a strength, weakness, or fitness judgment, and never as a factor in the keyStrengths or developmentPriorities lists. If a Cognitive Reasoning result is given, treat it the same way — it is a self-development input, never a general-intelligence or hiring/promotion judgment, and should not be framed as a strength or weakness. Write like a careful analyst, not a marketing brochure.",
      tools: [ASSESSMENT_SUMMARY_TOOL],
      tool_choice: { type: "tool", name: "record_assessment_summary" },
      messages: [{ role: "user", content: prompt }],
    });
    await recordAiUsage(supabase, {
      organizationId,
      userId: user.id,
      feature: "employee_assessment_summary",
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });
    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") throw new Error("No structured output");
    summary = toolUse.input as typeof summary;
  } catch (err) {
    console.error("generateEmployeeAssessmentSummary failed:", err);
    return { error: "Couldn't generate the summary right now — try again in a moment." };
  }

  const { error } = await supabase.from("employee_assessment_summaries").upsert(
    {
      employee_user_id: employeeUserId,
      summary,
      generated_by: user.id,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "employee_user_id" }
  );
  if (error) return { error: "Could not save the summary — the database may need migration 0062 run first." };

  revalidatePath(`/dashboard/company/${employeeUserId}`);
  return { success: true };
}

// Admin-only, deletes the whole workspace. Cascades to organization_members
// and organization_invites via the on-delete-cascade FKs in 0016/0017 — one
// delete, not a manual cleanup of each child table.
// Grace period before a scheduled deletion actually runs (see migration
// 0059's purge_scheduled_organization_deletions, called daily by
// /api/cron/purge-deletions) — long enough to notice and undo a mistaken
// click, short enough that "delete" still means something.
const DELETION_GRACE_DAYS = 30;

// No longer deletes immediately — schedules it. The workspace keeps
// working completely normally for everyone until the grace period lapses;
// only the actual purge (in the cron-triggered SQL function) permanently
// removes anything. RLS ("Org admins can update their own organization",
// 0033) already scopes this update to the org's own admin.
export async function deleteOrganization(organizationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const deletionAt = new Date(Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("organizations")
    .update({ pending_deletion_at: deletionAt })
    .eq("id", organizationId);
  if (error) return { error: "Could not schedule deletion — try again" };

  revalidatePath("/dashboard/company");
  return { success: true, deletionAt };
}

export async function cancelOrganizationDeletion(organizationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("organizations")
    .update({ pending_deletion_at: null })
    .eq("id", organizationId);
  if (error) return { error: "Could not cancel — try again" };

  revalidatePath("/dashboard/company");
  return { success: true };
}

// HR record editing — authorization is enforced by RLS (the
// "Org admins can update member records" policy from migration 0049), so a
// non-admin's update simply matches zero rows. The explicit zero-row check
// below turns that silent no-op into a visible error.
export async function updateMemberDetails(
  memberId: string,
  fields: {
    title?: string;
    department?: string;
    country?: string;
    manager_name?: string;
    manager_email?: string;
    business_unit?: string;
    location?: string;
    employee_id?: string;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const clean = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, typeof v === "string" ? v.trim() || null : v])
  );

  const { data, error } = await supabase
    .from("organization_members")
    .update(clean)
    .eq("id", memberId)
    .select("id");
  if (error) {
    console.error("updateMemberDetails failed:", error);
    return { error: "Could not update — the database may need migration 0049 run first." };
  }
  if (!data || data.length === 0) {
    return { error: "Not authorized to edit this employee." };
  }

  revalidatePath("/dashboard/company/employees");
  return { success: true };
}

export async function setMemberArchived(memberId: string, archived: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("organization_members")
    .update({ archived })
    .eq("id", memberId)
    .select("id");
  if (error) {
    console.error("setMemberArchived failed:", error);
    return { error: "Could not update — the database may need migration 0049 run first." };
  }
  if (!data || data.length === 0) {
    return { error: "Not authorized to archive this employee." };
  }

  revalidatePath("/dashboard/company/employees");
  return { success: true };
}

// A company can have any number of admins — organization_members.role is
// just 'admin'/'member' with no uniqueness constraint, and the existing
// "Org admins can update member records" policy (0049) already covers role
// changes since it doesn't restrict which columns an admin can touch. The
// one thing worth guarding in code (not just relying on RLS for) is
// demoting the org's last remaining admin, which would lock everyone out
// of the Company dashboard with no way back in short of direct DB access.
export async function setMemberRole(memberId: string, role: "admin" | "member") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (role === "member") {
    const { data: target } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("id", memberId)
      .maybeSingle<{ organization_id: string; role: string }>();
    if (target?.role === "admin") {
      const { count: adminCount } = await supabase
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", target.organization_id)
        .eq("role", "admin");
      if ((adminCount ?? 0) <= 1) {
        return { error: "This is the only admin — promote someone else first before removing admin access." };
      }
    }
  }

  const { data, error } = await supabase
    .from("organization_members")
    .update({ role })
    .eq("id", memberId)
    .select("id");
  if (error) {
    console.error("setMemberRole failed:", error);
    return { error: "Could not update this person's role." };
  }
  if (!data || data.length === 0) {
    return { error: "Not authorized to change this employee's role." };
  }

  revalidatePath("/dashboard/company/employees");
  return { success: true };
}

// Enterprise employees can't self-delete their data (see deleteMyData,
// app/dashboard/actions.ts) — only their org admin can, since the
// organization has a legitimate governance interest in that data. These
// two call a narrowly-scoped SECURITY DEFINER function (migration 0066)
// rather than updating profiles directly: a plain RLS UPDATE policy on
// Performance rating and manager notes (migration 0068) — direct
// management input, never AI-inferred, and always optional: nothing else
// (9-box, HiPo, succession math) requires either to exist. They're
// surfaced as additional context wherever an admin views an employee, and
// as optional extra lines in the succession/summary AI prompts when set.
export async function updateMemberPerformance(memberId: string, rating: number | null, note: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (rating !== null && (rating < 1 || rating > 5)) return { error: "Rating must be between 1 and 5" };

  const { data, error } = await supabase
    .from("organization_members")
    .update({
      performance_rating: rating,
      performance_rating_note: note.trim().slice(0, 1000),
      performance_rating_updated_at: new Date().toISOString(),
    })
    .eq("id", memberId)
    .select("id, organization_id, user_id");
  if (error) {
    console.error("updateMemberPerformance failed:", error);
    return { error: "Could not update — the database may need migration 0068 run first." };
  }
  if (!data || data.length === 0) return { error: "Not authorized to edit this employee." };

  // Snapshot for Phase 1 of the retention/Flight Risk roadmap — a single
  // point-in-time row per change, not an old/new diff, since the sequence
  // of ratings over time IS the trend; nothing downstream needs to know
  // what it changed FROM. Only logged when actually set (not cleared to
  // null) — clearing a rating isn't a meaningful data point.
  if (rating !== null) {
    const row = data[0];
    await supabase.from("employee_performance_rating_history").insert({
      organization_id: row.organization_id,
      employee_user_id: row.user_id,
      rating,
      note: note.trim().slice(0, 1000),
      recorded_by: user.id,
    });
  }

  revalidatePath("/dashboard/company/employees");
  return { success: true };
}

const MAX_MANAGER_NOTE = 2000;

export async function addManagerNote(employeeUserId: string, note: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) return { error: "Not authorized" };

  const trimmed = note.trim().slice(0, MAX_MANAGER_NOTE);
  if (!trimmed) return { error: "Write a note first" };

  const { error } = await supabase.from("employee_manager_notes").insert({
    organization_id: data.organizationId,
    employee_user_id: employeeUserId,
    author_id: user.id,
    note: trimmed,
  });
  if (error) {
    console.error("addManagerNote failed:", error);
    return { error: "Could not save the note — the database may need migration 0068 run first." };
  }
  revalidatePath(`/dashboard/company/${employeeUserId}`);
  return { success: true };
}

export async function deleteManagerNote(noteId: string, employeeUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  // RLS restricts this to admins of the note's own org — a non-admin's
  // delete simply matches zero rows.
  await supabase.from("employee_manager_notes").delete().eq("id", noteId);
  revalidatePath(`/dashboard/company/${employeeUserId}`);
  return { success: true };
}

// profiles gated by is_org_admin_of_user() would let an admin edit
// anything on the row, not just trigger deletion, so the SQL function is
// the safer, narrower grant.
export async function adminScheduleEmployeeDataDeletion(employeeUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase.rpc("admin_schedule_employee_data_deletion", {
    employee_id: employeeUserId,
  });
  if (error) {
    console.error("adminScheduleEmployeeDataDeletion failed:", error);
    return { error: "Could not schedule deletion — the database may need migration 0066 run first." };
  }

  revalidatePath("/dashboard/company/employees");
  revalidatePath(`/dashboard/company/${employeeUserId}`);
  return { success: true, deletionAt: data as string };
}

export async function adminCancelEmployeeDataDeletion(employeeUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.rpc("admin_cancel_employee_data_deletion", {
    employee_id: employeeUserId,
  });
  if (error) {
    console.error("adminCancelEmployeeDataDeletion failed:", error);
    return { error: "Could not cancel — try again." };
  }

  revalidatePath("/dashboard/company/employees");
  revalidatePath(`/dashboard/company/${employeeUserId}`);
  return { success: true };
}
