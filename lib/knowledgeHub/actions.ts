"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { sendEmail } from "@/lib/email/resend";
import { renderEmail, escapeHtml, customMessageHtml } from "@/lib/email/template";
import { getEmailMessageOverride } from "@/lib/organizations/emailMessages";
import type {
  KnowledgeHubContent,
  KnowledgeHubCompletion,
  KnowledgeHubExamQuestionForTaking,
  KnowledgeHubCompletionType,
} from "@/lib/supabase/types";
import { KNOWLEDGE_HUB_BUCKET } from "./constants";

type NewExamQuestion = { prompt: string; options: string[]; correctIndex: number };

// Called after the client has already uploaded the file directly to Storage
// (same split as avatar/org-logo uploads elsewhere in this app — the
// browser uploads to Supabase Storage itself, then this action only
// persists the resulting path). The client generates and passes `id` so the
// storage path (which is written before this row exists) can be organized
// under it — see KnowledgeHubUploadForm.tsx.
export async function createKnowledgeHubContent(input: {
  id: string;
  title: string;
  description: string;
  storagePath: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  completionType: KnowledgeHubCompletionType;
  passingScorePercent: number;
  maxAttempts?: number | null;
  dueDate?: string | null;
  isNewHireContent?: boolean;
  questions?: NewExamQuestion[];
}) {
  const company = await buildCompanyData();
  if (!company.isOrgAdmin || !company.organizationId) return { error: "Not authorized" };

  const title = input.title.trim();
  if (!title) return { error: "Title is required" };
  if (input.completionType === "exam" && (!input.questions || input.questions.length === 0)) {
    return { error: "Add at least one question for an exam" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error: contentError } = await supabase.from("knowledge_hub_content").insert({
    id: input.id,
    organization_id: company.organizationId,
    title,
    description: input.description.trim() || null,
    storage_path: input.storagePath,
    file_name: input.fileName,
    file_size_bytes: input.fileSizeBytes,
    mime_type: input.mimeType,
    completion_type: input.completionType,
    passing_score_percent: input.passingScorePercent,
    max_attempts: input.completionType === "exam" ? input.maxAttempts ?? null : null,
    due_date: input.dueDate || null,
    is_new_hire_content: input.isNewHireContent ?? false,
    created_by: user.id,
  });
  if (contentError) {
    return { error: "Could not save content — the database may need migration 0084 run first." };
  }

  if (input.completionType === "exam" && input.questions?.length) {
    const { data: insertedQuestions, error: questionsError } = await supabase
      .from("knowledge_hub_exam_questions")
      .insert(
        input.questions.map((q, i) => ({
          content_id: input.id,
          prompt: q.prompt.trim(),
          options: q.options.map((o) => o.trim()),
          order_index: i,
        }))
      )
      .select("id")
      .returns<{ id: string }[]>();
    if (questionsError || !insertedQuestions) {
      return { error: "Content saved, but could not save exam questions — try editing it again." };
    }

    const { error: keysError } = await supabase.from("knowledge_hub_exam_answer_keys").insert(
      insertedQuestions.map((row, i) => ({
        question_id: row.id,
        correct_index: input.questions![i].correctIndex,
      }))
    );
    if (keysError) {
      return { error: "Content saved, but could not save the exam answer key — try editing it again." };
    }
  }

  revalidatePath("/dashboard/company/knowledge-hub");
  return { success: true, contentId: input.id };
}

// Called from lib/automations/recipes.ts's runHireWelcome on every new
// hire — every unarchived document an admin has flagged "assign
// automatically to new hires" gets assigned via assignKnowledgeHubContent
// below, reusing its existing diff-against-already-assigned + notification
// email logic rather than inventing a separate onboarding-specific path.
export async function listNewHireContentIds(organizationId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("knowledge_hub_content")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_new_hire_content", true)
    .is("archived_at", null)
    .returns<{ id: string }[]>();
  return (data ?? []).map((r) => r.id);
}

// Best-effort — a failed assignment email shouldn't fail the assignment
// itself (the row in knowledge_hub_assignments is still the source of
// truth), same posture as sendInviteEmail in lib/organizations/actions.ts.
async function sendKnowledgeHubAssignmentEmail(
  email: string,
  contentTitle: string,
  dueDate: string | null,
  orgName: string,
  organizationId: string
): Promise<void> {
  try {
    const override = await getEmailMessageOverride(organizationId, "knowledge_hub_assignment");
    await sendEmail(
      email,
      override.subject || `${orgName} assigned you training on Devometrics`,
      renderEmail({
        preheader: `${contentTitle}${dueDate ? ` — due ${dueDate}` : ""}`,
        footerNote: "You're getting this because your organization assigned you training on Devometrics.",
        bodyHtml: `
          <h2 style="color:#16161a;font-size:20px;margin:0 0 16px;">New training assigned</h2>
          ${customMessageHtml(override.message)}
          <p style="font-size:15px;line-height:1.7;margin:0 0 8px;">
            <strong>${escapeHtml(orgName)}</strong> assigned you <strong>${escapeHtml(contentTitle)}</strong> on Devometrics.
          </p>
          ${
            dueDate
              ? `<p style="font-size:13px;color:#8892a4;margin:0 0 24px;">Due by ${escapeHtml(dueDate)}</p>`
              : `<p style="margin:0 0 24px;"></p>`
          }
          <p style="margin:0;">
            <a href="https://devometrics.com/dashboard/knowledge-hub" style="background:#3f7a67;color:#16161a;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;display:inline-block;font-size:14px;">Open Knowledge Hub →</a>
          </p>
        `,
      })
    );
  } catch (err) {
    console.error(`Knowledge Hub assignment email failed for ${email}:`, err);
  }
}

// Bulk assign — uses upsert with ignoreDuplicates so assigning to a mix of
// already-assigned and new employees in one call succeeds for the new ones
// instead of the whole insert failing on the first unique-constraint hit
// (a plain multi-row .insert() aborts entirely if any row conflicts).
// Only genuinely-new assignees get an email — re-running an assignment
// over a batch that includes already-assigned people shouldn't re-notify
// them, so the existing rows are diffed out before the upsert.
export async function assignKnowledgeHubContent(contentId: string, employeeUserIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (employeeUserIds.length === 0) return { error: "Select at least one employee" };

  const { data: existing } = await supabase
    .from("knowledge_hub_assignments")
    .select("employee_user_id")
    .eq("content_id", contentId)
    .in("employee_user_id", employeeUserIds)
    .returns<{ employee_user_id: string }[]>();
  const alreadyAssigned = new Set((existing ?? []).map((r) => r.employee_user_id));
  const newlyAssignedIds = employeeUserIds.filter((id) => !alreadyAssigned.has(id));

  const { error } = await supabase
    .from("knowledge_hub_assignments")
    .upsert(
      employeeUserIds.map((employeeUserId) => ({
        content_id: contentId,
        employee_user_id: employeeUserId,
        assigned_by: user.id,
      })),
      { onConflict: "employee_user_id,content_id", ignoreDuplicates: true }
    );
  if (error) {
    return { error: "Could not assign — the database may need migration 0084 run first." };
  }

  if (newlyAssignedIds.length > 0) {
    const [{ data: content }, company] = await Promise.all([
      supabase
        .from("knowledge_hub_content")
        .select("title, due_date")
        .eq("id", contentId)
        .maybeSingle<{ title: string; due_date: string | null }>(),
      buildCompanyData(),
    ]);
    if (content && company.organizationName && company.organizationId) {
      const emailByUserId = new Map(company.rows.map((r) => [r.userId, r.email]));
      await Promise.allSettled(
        newlyAssignedIds
          .map((id) => emailByUserId.get(id))
          .filter((email): email is string => !!email)
          .map((email) =>
            sendKnowledgeHubAssignmentEmail(email, content.title, content.due_date, company.organizationName!, company.organizationId!)
          )
      );
    }
  }

  revalidatePath("/dashboard/company/knowledge-hub");
  revalidatePath(`/dashboard/company/knowledge-hub/${contentId}`);
  return { success: true };
}

// Archives rather than deletes — knowledge_hub_content cascades to
// knowledge_hub_completions, and a real delete would destroy the
// compliance completion history for anyone who already finished it. This
// just hides it from active admin/employee lists while keeping the row
// (and its history) intact, same posture as organization_members.archived.
export async function archiveKnowledgeHubContent(contentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("knowledge_hub_content")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", contentId)
    .select("id");
  if (error) {
    return { error: "Could not archive — the database may need migration 0085 run first." };
  }
  if (!data || data.length === 0) {
    return { error: "Not authorized to archive this content." };
  }

  revalidatePath("/dashboard/company/knowledge-hub");
  return { success: true };
}

// Restores a previously-archived item to the active list — the missing
// other half of archiveKnowledgeHubContent below. archived_at is the only
// thing that changes; the row (and its completion history) was never
// touched by archiving in the first place, so this is a pure un-hide.
export async function unarchiveKnowledgeHubContent(contentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("knowledge_hub_content")
    .update({ archived_at: null })
    .eq("id", contentId)
    .select("id");
  if (error) {
    return { error: "Could not restore — the database may need migration 0085 run first." };
  }
  if (!data || data.length === 0) {
    return { error: "Not authorized to restore this content." };
  }

  revalidatePath("/dashboard/company/knowledge-hub");
  return { success: true };
}

// A real delete — distinct from archiveKnowledgeHubContent above, which is
// deliberately a soft-hide. Only permitted when NO ONE has completed this
// item yet: knowledge_hub_content cascades to knowledge_hub_completions
// (0084), and a real delete on content with real completion history would
// silently destroy that compliance audit trail. Content nobody's touched
// yet has nothing to protect, so a genuine mistaken upload can be fully
// removed rather than left as permanent archived clutter.
export async function deleteKnowledgeHubContent(contentId: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("knowledge_hub_completions")
    .select("id", { count: "exact", head: true })
    .eq("content_id", contentId);
  if ((count ?? 0) > 0) {
    return { error: "Someone has completed this content in the past (even if no longer assigned), so it can't be permanently deleted — archive it instead to preserve that history." };
  }

  const { data, error } = await supabase.from("knowledge_hub_content").delete().eq("id", contentId).select("id");
  if (error) return { error: "Could not delete this content." };
  if (!data || data.length === 0) return { error: "Not authorized to delete this content." };

  revalidatePath("/dashboard/company/knowledge-hub");
  return { success: true };
}

export type KnowledgeHubContentVersion = {
  id: string;
  title: string;
  description: string | null;
  passingScorePercent: number;
  maxAttempts: number | null;
  dueDate: string | null;
  editedByName: string | null;
  editedAt: string;
};

// Read-only history for the detail page's admin view — every snapshot
// updateKnowledgeHubContent wrote, newest first.
export async function listKnowledgeHubContentVersions(contentId: string): Promise<KnowledgeHubContentVersion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("knowledge_hub_content_versions")
    .select("id, title, description, passing_score_percent, max_attempts, due_date, edited_at, profiles(full_name)")
    .eq("content_id", contentId)
    .order("edited_at", { ascending: false })
    .returns<
      { id: string; title: string; description: string | null; passing_score_percent: number; max_attempts: number | null; due_date: string | null; edited_at: string; profiles: { full_name: string | null } | null }[]
    >();

  return (data ?? []).map((v) => ({
    id: v.id,
    title: v.title,
    description: v.description,
    passingScorePercent: v.passing_score_percent,
    maxAttempts: v.max_attempts,
    dueDate: v.due_date,
    editedByName: v.profiles?.full_name ?? null,
    editedAt: v.edited_at,
  }));
}

// Best-effort — mirrors sendKnowledgeHubAssignmentEmail's posture exactly;
// a failed notification never blocks the edit that triggered it.
async function sendKnowledgeHubUpdateEmail(email: string, contentTitle: string, orgName: string, organizationId: string): Promise<void> {
  try {
    const override = await getEmailMessageOverride(organizationId, "knowledge_hub_content_updated");
    await sendEmail(
      email,
      override.subject || `${orgName} updated your assigned training`,
      renderEmail({
        preheader: contentTitle,
        footerNote: "You're getting this because your organization assigned you this training on Devometrics.",
        bodyHtml: `
          <h2 style="color:#16161a;font-size:20px;margin:0 0 16px;">Training content updated</h2>
          ${customMessageHtml(override.message)}
          <p style="font-size:15px;line-height:1.7;margin:0 0 24px;">
            <strong>${escapeHtml(orgName)}</strong> made an update to <strong>${escapeHtml(contentTitle)}</strong>, which you're assigned. Worth a look if you've already started or completed it.
          </p>
          <p style="margin:0;">
            <a href="https://devometrics.com/dashboard/knowledge-hub" style="background:#3f7a67;color:#16161a;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;display:inline-block;font-size:14px;">Open Knowledge Hub →</a>
          </p>
        `,
      })
    );
  } catch (err) {
    console.error(`Knowledge Hub update email failed for ${email}:`, err);
  }
}

export async function updateKnowledgeHubContent(
  contentId: string,
  fields: {
    title: string;
    description: string;
    passingScorePercent: number;
    maxAttempts: number | null;
    dueDate: string | null;
    isNewHireContent: boolean;
  },
  notifyLearners = false
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const title = fields.title.trim();
  if (!title) return { error: "Title is required" };

  // Snapshot BEFORE the update — this is what the item looked like right
  // up until this edit, not the new values (which are already recoverable
  // from the live row).
  const { data: before } = await supabase
    .from("knowledge_hub_content")
    .select("organization_id, title, description, passing_score_percent, max_attempts, due_date, is_new_hire_content")
    .eq("id", contentId)
    .maybeSingle<{ organization_id: string; title: string; description: string | null; passing_score_percent: number; max_attempts: number | null; due_date: string | null; is_new_hire_content: boolean }>();

  const { data, error } = await supabase
    .from("knowledge_hub_content")
    .update({
      title,
      description: fields.description.trim() || null,
      passing_score_percent: fields.passingScorePercent,
      max_attempts: fields.maxAttempts,
      due_date: fields.dueDate || null,
      is_new_hire_content: fields.isNewHireContent,
    })
    .eq("id", contentId)
    .select("id");
  if (error) {
    return { error: "Could not update this content." };
  }
  if (!data || data.length === 0) {
    return { error: "Not authorized to edit this content." };
  }

  if (before) {
    const { error: versionError } = await supabase.from("knowledge_hub_content_versions").insert({
      content_id: contentId,
      organization_id: before.organization_id,
      title: before.title,
      description: before.description,
      passing_score_percent: before.passing_score_percent,
      max_attempts: before.max_attempts,
      due_date: before.due_date,
      is_new_hire_content: before.is_new_hire_content,
      edited_by: user.id,
    });
    // Never fails the edit itself — version history is a nice-to-have
    // audit trail, not a gate on being able to fix a typo. Logged so a
    // silently-missing 0115 migration is at least visible server-side.
    if (versionError) console.error("knowledge_hub_content_versions insert failed (non-fatal):", versionError);

    if (notifyLearners) {
      const [{ data: assignments }, company] = await Promise.all([
        supabase.from("knowledge_hub_assignments").select("employee_user_id").eq("content_id", contentId).returns<{ employee_user_id: string }[]>(),
        buildCompanyData(),
      ]);
      if (assignments && assignments.length > 0 && company.organizationName && company.organizationId) {
        const emailByUserId = new Map(company.rows.map((r) => [r.userId, r.email]));
        await Promise.allSettled(
          assignments
            .map((a) => emailByUserId.get(a.employee_user_id))
            .filter((email): email is string => !!email)
            .map((email) => sendKnowledgeHubUpdateEmail(email, title, company.organizationName!, company.organizationId!))
        );
      }
    }
  }

  revalidatePath("/dashboard/company/knowledge-hub");
  revalidatePath(`/dashboard/company/knowledge-hub/${contentId}`);
  return { success: true };
}

export async function removeKnowledgeHubAssignment(assignmentId: string, contentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  await supabase.from("knowledge_hub_assignments").delete().eq("id", assignmentId);

  revalidatePath(`/dashboard/company/knowledge-hub/${contentId}`);
  return { success: true };
}

export type KnowledgeHubReportRow = {
  employeeUserId: string;
  name: string;
  email: string;
  // Null when this person completed the content in the past but is no
  // longer currently assigned (their assignment row was removed) — the
  // completion record is kept forever, so they still show up here, but
  // there's no active assignment left to remove.
  assignmentId: string | null;
  status: "not_started" | "completed";
  completedAt: string | null;
  scorePercent: number | null;
  passed: boolean | null;
  examAttempts: number;
};

export type KnowledgeHubContentReport = {
  content: KnowledgeHubContent | null;
  rows: KnowledgeHubReportRow[];
  assignedCount: number;
  completedCount: number;
  completionRate: number;
  averageScorePercent: number | null;
  passRate: number | null;
};

// The reporting surface HR/Admin needs: who's completed, who hasn't, scores
// where applicable. All the data this reads from is already scoped by
// is_org_admin_of_user() at the RLS layer — this just aggregates it.
export async function getKnowledgeHubContentReport(contentId: string): Promise<KnowledgeHubContentReport> {
  const empty: KnowledgeHubContentReport = {
    content: null,
    rows: [],
    assignedCount: 0,
    completedCount: 0,
    completionRate: 0,
    averageScorePercent: null,
    passRate: null,
  };

  const company = await buildCompanyData();
  if (!company.isOrgAdmin) return empty;

  const supabase = await createClient();
  const { data: content } = await supabase
    .from("knowledge_hub_content")
    .select("*")
    .eq("id", contentId)
    .maybeSingle<KnowledgeHubContent>();
  if (!content) return empty;

  const [{ data: assignments }, { data: completions }] = await Promise.all([
    supabase
      .from("knowledge_hub_assignments")
      .select("id, employee_user_id")
      .eq("content_id", contentId)
      .returns<{ id: string; employee_user_id: string }[]>(),
    supabase
      .from("knowledge_hub_completions")
      .select("*")
      .eq("content_id", contentId)
      .order("completed_at", { ascending: false })
      .returns<KnowledgeHubCompletion[]>(),
  ]);

  const assignmentIdByEmployee = new Map((assignments ?? []).map((a) => [a.employee_user_id, a.id]));

  // Completions are append-only history — someone who completed this and
  // was later unassigned still needs to show up here, otherwise the
  // completion count and the assigned count silently disagree (a real
  // person completed it, but they'd vanish from the list). The row set is
  // the union of "currently assigned" and "has ever completed this."
  const employeeIds = Array.from(new Set([...(assignments ?? []).map((a) => a.employee_user_id), ...(completions ?? []).map((c) => c.employee_user_id)]));
  const nameByUserId = new Map(company.rows.filter((r) => employeeIds.includes(r.userId)).map((r) => [r.userId, r]));

  // Latest completion per employee — completions are append-only (full
  // re-certification history), the report shows the most recent attempt.
  const latestCompletionByEmployee = new Map<string, KnowledgeHubCompletion>();
  const examAttemptsByEmployee = new Map<string, number>();
  for (const c of completions ?? []) {
    if (!latestCompletionByEmployee.has(c.employee_user_id)) latestCompletionByEmployee.set(c.employee_user_id, c);
    if (c.method === "exam") {
      examAttemptsByEmployee.set(c.employee_user_id, (examAttemptsByEmployee.get(c.employee_user_id) ?? 0) + 1);
    }
  }

  const rows: KnowledgeHubReportRow[] = employeeIds.map((employeeUserId) => {
    const person = nameByUserId.get(employeeUserId);
    const completion = latestCompletionByEmployee.get(employeeUserId);
    return {
      employeeUserId,
      name: person?.name ?? "Unknown",
      email: person?.email ?? "",
      assignmentId: assignmentIdByEmployee.get(employeeUserId) ?? null,
      status: completion ? "completed" : "not_started",
      completedAt: completion?.completed_at ?? null,
      scorePercent: completion?.score_percent ?? null,
      passed: completion?.passed ?? null,
      examAttempts: examAttemptsByEmployee.get(employeeUserId) ?? 0,
    };
  });

  const completedRows = rows.filter((r) => r.status === "completed");
  const examScores = completedRows.map((r) => r.scorePercent).filter((s): s is number => s !== null);

  return {
    content,
    rows,
    assignedCount: rows.length,
    completedCount: completedRows.length,
    completionRate: rows.length ? Math.round((completedRows.length / rows.length) * 100) : 0,
    averageScorePercent: examScores.length
      ? Math.round(examScores.reduce((a, b) => a + b, 0) / examScores.length)
      : null,
    passRate: completedRows.length
      ? Math.round((completedRows.filter((r) => r.passed).length / completedRows.length) * 100)
      : null,
  };
}

// Employee-facing — verifies the caller actually has this assigned (defense
// in depth alongside storage RLS, which independently allows any org
// member, not just specifically-assigned ones) before minting a short-lived
// signed URL. Private bucket, so this is the only way to read the file.
export async function getSignedKnowledgeHubUrl(contentId: string): Promise<{ error: string } | { url: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: assignment } = await supabase
    .from("knowledge_hub_assignments")
    .select("id")
    .eq("content_id", contentId)
    .eq("employee_user_id", user.id)
    .maybeSingle<{ id: string }>();
  if (!assignment) return { error: "This isn't assigned to you" };

  const { data: content } = await supabase
    .from("knowledge_hub_content")
    .select("storage_path")
    .eq("id", contentId)
    .maybeSingle<{ storage_path: string }>();
  if (!content) return { error: "Content not found" };

  const { data, error } = await supabase.storage
    .from(KNOWLEDGE_HUB_BUCKET)
    .createSignedUrl(content.storage_path, 300);
  if (error || !data) return { error: "Could not open this document — try again." };

  return { url: data.signedUrl };
}

export async function confirmKnowledgeHubRead(contentId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_knowledge_hub_read", { p_content_id: contentId });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/knowledge-hub");
  revalidatePath(`/dashboard/knowledge-hub/${contentId}`);
  return { success: true };
}

export async function getKnowledgeHubExamQuestions(
  contentId: string
): Promise<{ error: string } | { questions: KnowledgeHubExamQuestionForTaking[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_knowledge_hub_exam_questions", { p_content_id: contentId });
  const rows = data as { question_id: string; prompt: string; options: string[]; order_index: number }[] | null;
  if (error || !rows) return { error: error?.message ?? "Could not load this exam" };

  const questions: KnowledgeHubExamQuestionForTaking[] = rows
    .map((q) => ({ question_id: q.question_id, prompt: q.prompt, options: q.options, order_index: q.order_index }))
    .sort((a, b) => a.order_index - b.order_index);
  return { questions };
}

export async function submitKnowledgeHubExam(
  contentId: string,
  answers: { question_id: string; selected_index: number }[]
): Promise<{ error: string } | { success: true; scorePercent: number; passed: boolean; attemptNumber: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_knowledge_hub_exam", { p_content_id: contentId, p_answers: answers });
  const rows = data as { score_percent: number; passed: boolean; attempt_number: number }[] | null;
  if (error || !rows?.[0]) return { error: error?.message ?? "Could not submit this exam" };

  revalidatePath("/dashboard/knowledge-hub");
  revalidatePath(`/dashboard/knowledge-hub/${contentId}`);
  return { success: true, scorePercent: rows[0].score_percent, passed: rows[0].passed, attemptNumber: rows[0].attempt_number };
}

export type KnowledgeHubAttempt = {
  id: string;
  method: KnowledgeHubCompletionType;
  scorePercent: number | null;
  passed: boolean;
  completedAt: string;
};

// Full attempt history for one employee on one piece of content — relies
// entirely on the existing RLS policies on knowledge_hub_completions
// ("Employees can view their own" / "Org admins can view ... for their
// members"), same posture as getKnowledgeHubContentReport above: a
// non-admin querying someone else's history just gets zero rows back from
// Postgres, no app-layer check needed on top.
export async function getKnowledgeHubEmployeeAttempts(
  contentId: string,
  employeeUserId: string
): Promise<KnowledgeHubAttempt[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("knowledge_hub_completions")
    .select("id, method, score_percent, passed, completed_at")
    .eq("content_id", contentId)
    .eq("employee_user_id", employeeUserId)
    .order("completed_at", { ascending: false })
    .returns<{ id: string; method: KnowledgeHubCompletionType; score_percent: number | null; passed: boolean; completed_at: string }[]>();

  return (data ?? []).map((r) => ({
    id: r.id,
    method: r.method,
    scorePercent: r.score_percent,
    passed: r.passed,
    completedAt: r.completed_at,
  }));
}
