"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { sendEmail } from "@/lib/email/resend";
import { renderEmail, escapeHtml, customMessageHtml } from "@/lib/email/template";
import { getEmailMessageOverride } from "@/lib/organizations/emailMessages";
import { extractCompetencies } from "@/lib/gap-analysis/extract";
import { sanitizeCompetencyScores, careerHealthScore } from "@/lib/gap-analysis/dimensions";
import {
  MAX_CV_LENGTH,
  MAX_JOB_DESCRIPTION_LENGTH,
  MAX_TARGET_ROLE_LENGTH,
  HIRING_CV_SCORE_RATE_LIMIT_WINDOW_MINUTES,
  hiringCvScoreDailyLimit,
} from "@/lib/limits";
import { CANDIDATE_CV_BUCKET } from "./constants";
import type { HiringStage } from "./types";
import { HIRING_STAGES } from "./types";
import { assertAiBudgetOk, recordAiUsage } from "@/lib/aiUsage/track";

const MAX_NAME = 120;
const MAX_PHONE = 40;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, organizationId: null };
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) return { supabase, user: null, organizationId: null };
  return { supabase, user, organizationId: data.organizationId };
}

export async function createCandidate(postingId: string, fields: { fullName: string; email: string; phone?: string }) {
  const { supabase, user, organizationId } = await requireAdmin();
  if (!user || !organizationId) return { error: "Not authorized" };

  const fullName = fields.fullName.trim().slice(0, MAX_NAME);
  if (!fullName) return { error: "Give the candidate a name" };
  const email = fields.email.trim().toLowerCase();
  if (!email || !email.includes("@")) return { error: "A valid email is required" };

  const { data: posting } = await supabase
    .from("job_postings")
    .select("id")
    .eq("id", postingId)
    .eq("organization_id", organizationId)
    .maybeSingle<{ id: string }>();
  if (!posting) return { error: "Posting not found" };

  const { data: candidate, error } = await supabase
    .from("hiring_candidates")
    .insert({
      organization_id: organizationId,
      posting_id: postingId,
      full_name: fullName,
      email,
      phone: (fields.phone ?? "").trim().slice(0, MAX_PHONE),
      created_by: user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !candidate) {
    console.error("createCandidate failed:", error);
    return { error: "Could not add the candidate — the database may need migration 0088 run first." };
  }

  await supabase.from("hiring_candidate_stage_history").insert({
    candidate_id: candidate.id,
    organization_id: organizationId,
    from_stage: null,
    to_stage: "applied",
    moved_by: user.id,
  });

  revalidatePath(`/dashboard/company/hiring/${postingId}`);
  return { success: true, candidateId: candidate.id };
}

// Called after the client has already uploaded the file directly to Storage
// (same split as KnowledgeHubUploadForm.tsx) — this action only persists the
// resulting path/metadata onto the candidate row.
export async function attachCandidateCv(
  candidateId: string,
  meta: { storagePath: string; fileName: string; fileSizeBytes: number; mimeType: string }
) {
  const { supabase, user, organizationId } = await requireAdmin();
  if (!user || !organizationId) return { error: "Not authorized" };

  const { data, error } = await supabase
    .from("hiring_candidates")
    .update({
      cv_storage_path: meta.storagePath,
      cv_file_name: meta.fileName.slice(0, 255),
      cv_file_size_bytes: meta.fileSizeBytes,
      cv_mime_type: meta.mimeType,
      updated_at: new Date().toISOString(),
    })
    .eq("id", candidateId)
    .eq("organization_id", organizationId)
    .select("posting_id")
    .maybeSingle<{ posting_id: string }>();
  if (error || !data) return { error: "Could not attach the CV — try again." };

  revalidatePath(`/dashboard/company/hiring/${data.posting_id}`);
  return { success: true };
}

// Scores a candidate's CV against their posting's requirements by calling
// extractCompetencies() directly — never buildBackgroundContext(), which is
// bound to the logged-in (admin's own) profile and would corrupt the
// candidate's score with the wrong person's data.
export async function scoreCandidateCv(candidateId: string, cvText: string): Promise<{ error: string } | { success: true }> {
  const { supabase, user, organizationId } = await requireAdmin();
  if (!user || !organizationId) return { error: "Not authorized" };

  const trimmedCv = cvText.trim().slice(0, MAX_CV_LENGTH);
  if (!trimmedCv) return { error: "No CV text to score" };

  const { count: employeeCount } = await supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  const dailyLimit = hiringCvScoreDailyLimit(employeeCount ?? 0);

  const windowStart = new Date(
    Date.now() - HIRING_CV_SCORE_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000
  ).toISOString();
  const { count: recentScoreCount } = await supabase
    .from("hiring_candidate_cv_scores")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("updated_at", windowStart);
  if ((recentScoreCount ?? 0) >= dailyLimit) {
    return {
      error: `Your organization has scored ${dailyLimit} CVs in the last 24 hours — the limit resets on a rolling basis. Contact support if you need this raised for a large hiring push.`,
    };
  }

  const { data: candidate } = await supabase
    .from("hiring_candidates")
    .select("id, posting_id")
    .eq("id", candidateId)
    .eq("organization_id", organizationId)
    .maybeSingle<{ id: string; posting_id: string }>();
  if (!candidate) return { error: "Candidate not found" };

  const { data: posting } = await supabase
    .from("job_postings")
    .select("title, job_description")
    .eq("id", candidate.posting_id)
    .maybeSingle<{ title: string; job_description: string }>();
  if (!posting) return { error: "Posting not found" };

  const budgetCheck = await assertAiBudgetOk(supabase, { organizationId, userId: user.id });
  if (budgetCheck.error) return { error: budgetCheck.error };

  const targetRole = posting.title.slice(0, MAX_TARGET_ROLE_LENGTH);
  const jobDescription = posting.job_description.slice(0, MAX_JOB_DESCRIPTION_LENGTH);

  try {
    const competencies = sanitizeCompetencyScores(
      await extractCompetencies({
        cvText: trimmedCv,
        jobDescription,
        targetRole,
        onUsage: (usage) => {
          // Fire-and-forget — never let usage logging block or fail the
          // actual CV scoring result.
          void recordAiUsage(supabase, {
            organizationId,
            userId: user.id,
            feature: "hiring_cv_score",
            model: usage.model,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
          });
        },
      })
    );
    const score = careerHealthScore(competencies);

    const { error } = await supabase
      .from("hiring_candidate_cv_scores")
      .upsert(
        {
          organization_id: organizationId,
          candidate_id: candidateId,
          posting_id: candidate.posting_id,
          target_role: targetRole,
          job_description: jobDescription,
          cv_text: trimmedCv,
          competencies,
          career_health_score: score,
          scored_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "candidate_id" }
      );
    if (error) {
      console.error("scoreCandidateCv upsert failed:", error);
      return { error: "Scored, but could not save the result — try again." };
    }
  } catch (err) {
    console.error("scoreCandidateCv failed:", err);
    return { error: "Couldn't score this CV right now — try again in a moment." };
  }

  revalidatePath(`/dashboard/company/hiring/${candidate.posting_id}`);
  revalidatePath(`/dashboard/company/hiring/${candidate.posting_id}/candidates/${candidateId}`);
  return { success: true };
}

// Best-effort, fired only when moving TO the interview stage. No fake
// time/date — there is no scheduling field anywhere in the hiring schema,
// so this is an honest "your application has moved to this stage" notice,
// not a calendar invite. hiring_candidates.email is a raw, non-authenticated
// address (the candidate has no Devometrics account), unlike every other
// email in this app — deliberately no dashboard-login CTA here, since
// there's no account to link to.
async function sendInterviewStageEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  candidateEmail: string,
  candidateName: string
): Promise<void> {
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .maybeSingle<{ name: string }>();
  if (!org?.name) return;

  try {
    const override = await getEmailMessageOverride(organizationId, "interview_stage_notice");
    const firstName = candidateName.trim().split(" ")[0] || "there";
    await sendEmail(
      candidateEmail,
      override.subject || `Your application with ${org.name} has moved to the interview stage`,
      renderEmail({
        preheader: `Update on your application to ${org.name}`,
        bodyHtml: `
          <h2 style="color:#0A0F1E;font-size:20px;margin:0 0 16px;">Hi ${escapeHtml(firstName)},</h2>
          ${customMessageHtml(override.message)}
          <p style="font-size:15px;line-height:1.7;margin:0;">
            Your application with <strong>${escapeHtml(org.name)}</strong> has moved to the interview stage. The hiring team will be in touch with next steps.
          </p>
        `,
        footerNote: `You're getting this because you applied to a role at ${org.name}.`,
      })
    );
  } catch (err) {
    console.error(`Interview stage email failed for ${candidateEmail}:`, err);
  }
}

export async function moveCandidateStage(candidateId: string, toStage: HiringStage, note?: string) {
  const { supabase, user, organizationId } = await requireAdmin();
  if (!user || !organizationId) return { error: "Not authorized" };
  if (!HIRING_STAGES.includes(toStage)) return { error: "Invalid stage" };

  const { data: candidate } = await supabase
    .from("hiring_candidates")
    .select("id, posting_id, stage, email, full_name")
    .eq("id", candidateId)
    .eq("organization_id", organizationId)
    .maybeSingle<{ id: string; posting_id: string; stage: HiringStage; email: string; full_name: string }>();
  if (!candidate) return { error: "Candidate not found" };

  const { error } = await supabase
    .from("hiring_candidates")
    .update({ stage: toStage, updated_at: new Date().toISOString() })
    .eq("id", candidateId);
  if (error) return { error: "Could not move the candidate — try again." };

  await supabase.from("hiring_candidate_stage_history").insert({
    candidate_id: candidateId,
    organization_id: organizationId,
    from_stage: candidate.stage,
    to_stage: toStage,
    moved_by: user.id,
    note: (note ?? "").trim().slice(0, 500),
  });

  if (toStage === "interview" && candidate.email) {
    await sendInterviewStageEmail(supabase, organizationId, candidate.email, candidate.full_name ?? "");
  }

  revalidatePath(`/dashboard/company/hiring/${candidate.posting_id}`);
  revalidatePath(`/dashboard/company/hiring/${candidate.posting_id}/candidates/${candidateId}`);
  return { success: true };
}

export async function deleteCandidate(candidateId: string) {
  const { supabase, user } = await requireAdmin();
  if (!user) return { error: "Not authorized" };

  const { data: candidate } = await supabase
    .from("hiring_candidates")
    .select("posting_id, cv_storage_path")
    .eq("id", candidateId)
    .maybeSingle<{ posting_id: string; cv_storage_path: string | null }>();
  if (!candidate) return { success: true };

  // RLS restricts the delete to admins of the candidate's own org — cascade
  // removes stage history, CV score, notes, and the assessment.
  await supabase.from("hiring_candidates").delete().eq("id", candidateId);
  if (candidate.cv_storage_path) {
    await supabase.storage.from(CANDIDATE_CV_BUCKET).remove([candidate.cv_storage_path]);
  }

  revalidatePath(`/dashboard/company/hiring/${candidate.posting_id}`);
  return { success: true };
}
