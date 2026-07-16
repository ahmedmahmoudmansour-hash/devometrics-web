"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { renderEmail, escapeHtml } from "@/lib/email/template";
import { buildEmployeeDetail } from "@/lib/organizations/aggregate";
import { ENGLISH_PROFICIENCY_SLUG, cefrLevelFromScore } from "@/lib/assessments/englishProficiency";
import { COGNITIVE_ABILITY_SLUG, cognitiveBandFromScore } from "@/lib/assessments/cognitiveAbility";
import { BIG_FIVE_TRAITS, bigFiveInterpretation } from "@/lib/personality/bigFive";
import type { OrganizationInvite, OrganizationMember } from "@/lib/supabase/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Best-effort — a failed invite email shouldn't fail the invite itself
// (the row in organization_invites is still the source of truth; the
// person is auto-attached the moment they sign up with that email either
// way, per checkAndConsumeInvite below).
async function sendInviteEmail(email: string, orgName: string): Promise<void> {
  try {
    await sendEmail(
      email,
      `You've been invited to join ${orgName} on Devometrics`,
      renderEmail({
        preheader: `${orgName} invited you to Devometrics`,
        bodyHtml: `
          <h2 style="color:#0A0F1E;font-size:20px;margin:0 0 16px;">You're invited</h2>
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

  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .maybeSingle<{ name: string }>();
  if (org?.name) await sendInviteEmail(trimmed, org.name);

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
    await Promise.allSettled(invited.map((r) => sendInviteEmail(r.email, org.name)));
  }

  revalidatePath("/dashboard/company");
  return { results };
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
    manager_name: invite.manager_name ?? null,
    manager_email: invite.manager_email ?? null,
    business_unit: invite.business_unit ?? null,
    location: invite.location ?? null,
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

export async function assignAssessment(employeeUserId: string, assessmentSlug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("assigned_assessments").insert({
    employee_user_id: employeeUserId,
    assessment_slug: assessmentSlug,
    assigned_by: user.id,
  });
  if (error) {
    // Unique constraint violation (already assigned) shouldn't read as a
    // real failure to the admin — same "already assigned" intent either way.
    if (error.code === "23505") return { error: "Already assigned to this person." };
    return { error: "Could not assign — the database may need migration 0058 run first." };
  }

  revalidatePath(`/dashboard/company/${employeeUserId}`);
  return { success: true };
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
  ].join("\n");

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

// Enterprise employees can't self-delete their data (see deleteMyData,
// app/dashboard/actions.ts) — only their org admin can, since the
// organization has a legitimate governance interest in that data. These
// two call a narrowly-scoped SECURITY DEFINER function (migration 0066)
// rather than updating profiles directly: a plain RLS UPDATE policy on
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
