import type { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { renderEmail, escapeHtml, customMessageHtml } from "@/lib/email/template";
import { getEmailMessageOverride } from "@/lib/organizations/emailMessages";
import { resolveAssessmentName } from "@/lib/assessments/catalog";
import { listNewHireContentIds, assignKnowledgeHubContent } from "@/lib/knowledgeHub/actions";
import { createAutomatedSingleEmployeeCycle } from "@/lib/performanceReviews/cycleAutomation";
import { isRecipeEnabled, logAutomation, firedRecently } from "./engine";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Fires from inside checkAndConsumeInvite() — the acting user IS the new
// employee joining. Onboarding was retired as a standalone feature in favor
// of ordinary Knowledge Hub content flagged is_new_hire_content (migration
// 0120) — this assigns every such flagged, unarchived document to the new
// hire via the same path an admin uses to assign content manually. The
// recipe key stays "hire_to_onboarding" (not renamed) so orgs that already
// have the automation toggle on don't silently lose it. The manager
// notification is an email, not a DB write into the manager's own
// rows — this app has no service-role key, so there's no privileged path
// to write into a different user's table on their behalf; email sidesteps
// that entirely since it isn't an RLS-governed action at all.
export async function runHireWelcome(
  supabase: SupabaseServerClient,
  params: { organizationId: string; employeeUserId: string; employeeName: string; orgName: string; managerEmail: string | null }
): Promise<void> {
  const enabled = await isRecipeEnabled(supabase, params.organizationId, "hire_to_onboarding");
  if (!enabled) return;

  const newHireContentIds = await listNewHireContentIds(params.organizationId);
  for (const contentId of newHireContentIds) {
    await assignKnowledgeHubContent(contentId, [params.employeeUserId]);
  }

  if (params.managerEmail) {
    try {
      // Reads via getEmailMessageOverride, not the SQL-join pattern the
      // cron reminders use, because this fires in the NEW EMPLOYEE's own
      // session (not an admin's) — the table's SELECT policy had to move
      // from admin-only to member-read (migration 0107) specifically so
      // this read isn't silently blocked by RLS.
      const override = await getEmailMessageOverride(params.organizationId, "hire_to_onboarding_manager_alert");
      await sendEmail(
        params.managerEmail,
        override.subject || `${params.employeeName} has joined ${params.orgName} on Devometrics`,
        renderEmail({
          preheader: `${params.employeeName} just joined — plan their 30-day check-in`,
          bodyHtml: `
            <h2 style="color:#16161a;font-size:20px;margin:0 0 16px;">${escapeHtml(params.employeeName)} has joined</h2>
            ${customMessageHtml(override.message)}
            <p style="font-size:15px;line-height:1.7;margin:0 0 16px;">
              They've signed up and are getting started on Devometrics. A good first move is scheduling a 30-day check-in to see how onboarding is going.
            </p>
          `,
          footerNote: "Sent automatically because your workspace has the \"New hire onboarding\" automation turned on.",
        })
      );
    } catch (err) {
      console.error("runHireWelcome: manager email failed (non-fatal):", err);
    }
  }

  await logAutomation(supabase, {
    organizationId: params.organizationId,
    recipeKey: "hire_to_onboarding",
    subjectUserId: params.employeeUserId,
    summary: `${newHireContentIds.length} new-hire Knowledge Hub document(s) assigned${params.managerEmail ? " and manager notified" : ""}.`,
  });
}

// Fires from inside checkAndConsumeInvite() — same self-scoped-session
// posture as runHireWelcome above. Starts a single-employee probation
// review hidden from the new hire until their hiring manager accepts it
// (requires_hiring_manager_acceptance, migration 0122) — HR schedules this
// automation once per org; the hiring manager reviews and accepts the
// generated template per-hire; HR/admins can still view or accept it at
// any time, same "admin can always do what a manager can do" posture used
// throughout this schema.
export async function runHireToProbation(
  supabase: SupabaseServerClient,
  params: { organizationId: string; employeeUserId: string; employeeName: string; managerEmail: string | null }
): Promise<void> {
  const enabled = await isRecipeEnabled(supabase, params.organizationId, "hire_to_probation");
  if (!enabled) return;

  const result = await createAutomatedSingleEmployeeCycle(supabase, {
    employeeUserId: params.employeeUserId,
    starterKey: "probation_review",
    cycleName: `${params.employeeName} — Probation Review`,
  });
  if ("error" in result) {
    console.error("runHireToProbation failed:", result.error);
    return;
  }

  // UX audit follow-up: the automation used to fire completely silently —
  // the review just sat on My Team until a manager happened to visit.
  // Same email-not-DB-write reasoning as runHireWelcome above (no
  // service-role key to write into the manager's own rows).
  if (params.managerEmail) {
    try {
      const override = await getEmailMessageOverride(params.organizationId, "probation_review_ready_alert");
      await sendEmail(
        params.managerEmail,
        override.subject || `${params.employeeName}'s probation review is ready for your acceptance`,
        renderEmail({
          preheader: `Review and accept ${params.employeeName}'s probation review to activate it`,
          bodyHtml: `
            <h2 style="color:#16161a;font-size:20px;margin:0 0 16px;">${escapeHtml(params.employeeName)}'s probation review is ready</h2>
            ${customMessageHtml(override.message)}
            <p style="font-size:15px;line-height:1.7;margin:0 0 16px;">
              A probation review has been started for them, but it stays hidden from them until you review and accept it from My Team.
            </p>
          `,
          footerNote: "Sent automatically because your workspace has the \"New hire probation review\" automation turned on.",
        })
      );
    } catch (err) {
      console.error("runHireToProbation: manager email failed (non-fatal):", err);
    }
  }

  await logAutomation(supabase, {
    organizationId: params.organizationId,
    recipeKey: "hire_to_probation",
    subjectUserId: params.employeeUserId,
    summary: `Probation review cycle created, pending hiring-manager acceptance${params.managerEmail ? " (manager notified)" : ""}.`,
  });
}

// Fires from inside saveAssessmentResult() — acting user is the person who
// just took the assessment, scoring themselves. Both tasks are
// self-scoped. Threshold is a development-focused heuristic (this
// codebase's Likert self-report scores run 0-100, same scale as Career
// Health Score and competency dimension averages), not a formal cutoff.
export async function runLowScoreToReassessment(
  supabase: SupabaseServerClient,
  params: { organizationId: string | null; userId: string; assessmentSlug: string; score: number }
): Promise<void> {
  if (!params.organizationId) return; // individual-only feature list for now — no org to gate the toggle against
  if (params.score >= 50) return;

  const enabled = await isRecipeEnabled(supabase, params.organizationId, "low_score_to_reassessment");
  if (!enabled) return;

  const name = resolveAssessmentName(params.assessmentSlug);
  await supabase.from("personal_tasks").insert([
    { user_id: params.userId, title: `Review your ${name} results`, recurring: "none", date: addDaysIso(0) },
    { user_id: params.userId, title: `Retake your ${name} assessment`, recurring: "none", date: addDaysIso(60) },
  ]);

  await logAutomation(supabase, {
    organizationId: params.organizationId,
    recipeKey: "low_score_to_reassessment",
    subjectUserId: params.userId,
    summary: `Follow-up tasks created after a ${params.score}/100 result on ${name}.`,
  });
}

// Fires from the Gap Analysis route — acting user is the person whose own
// analysis just ran. Dedup-guarded (30 days) so rerunning Gap Analysis
// while already flagged doesn't re-email the manager every time. Emails
// the manager rather than writing anything into their rows, same
// no-service-role-key reasoning as runHireToOnboarding.
export async function runHighPotentialToSuccession(
  supabase: SupabaseServerClient,
  params: { organizationId: string | null; userId: string; userName: string }
): Promise<void> {
  if (!params.organizationId) return;

  const enabled = await isRecipeEnabled(supabase, params.organizationId, "high_potential_to_succession");
  if (!enabled) return;

  const alreadyFired = await firedRecently(supabase, {
    organizationId: params.organizationId,
    recipeKey: "high_potential_to_succession",
    subjectUserId: params.userId,
    days: 30,
  });
  if (alreadyFired) return;

  const { data: memberRow } = await supabase
    .from("organization_members")
    .select("manager_user_id")
    .eq("organization_id", params.organizationId)
    .eq("user_id", params.userId)
    .maybeSingle<{ manager_user_id: string | null }>();
  if (!memberRow?.manager_user_id) return; // no manager on file in the Org Chart — nothing to notify

  const { data: managerProfile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", memberRow.manager_user_id)
    .maybeSingle<{ email: string | null }>();
  if (!managerProfile?.email) return;

  try {
    // Same RLS-relaxation dependency as runHireToOnboarding above — this
    // fires in the FLAGGED EMPLOYEE's own session, not an admin's.
    const override = await getEmailMessageOverride(params.organizationId, "high_potential_manager_alert");
    await sendEmail(
      managerProfile.email,
      override.subject || `${params.userName} flagged as High Potential on Devometrics`,
      renderEmail({
        preheader: `${params.userName}'s latest Gap Analysis places them in the High Potential zone`,
        bodyHtml: `
          <h2 style="color:#16161a;font-size:20px;margin:0 0 16px;">${escapeHtml(params.userName)} — High Potential</h2>
          ${customMessageHtml(override.message)}
          <p style="font-size:15px;line-height:1.7;margin:0 0 16px;">
            Their latest Gap Analysis places them in the High Potential zone of your team's talent grid. Worth considering them for succession planning and growth opportunities.
          </p>
        `,
        footerNote: "Sent automatically because your workspace has the \"High-potential flag to manager\" automation turned on.",
      })
    );
  } catch (err) {
    console.error("runHighPotentialToSuccession: manager email failed (non-fatal):", err);
    return; // don't log a firing that never actually reached anyone
  }

  await logAutomation(supabase, {
    organizationId: params.organizationId,
    recipeKey: "high_potential_to_succession",
    subjectUserId: params.userId,
    summary: `Manager notified after a High Potential Gap Analysis result.`,
  });
}
