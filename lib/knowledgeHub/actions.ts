"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { sendEmail } from "@/lib/email/resend";
import { renderEmail, escapeHtml } from "@/lib/email/template";
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
  dueDate?: string | null;
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
    due_date: input.dueDate || null,
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

// Best-effort — a failed assignment email shouldn't fail the assignment
// itself (the row in knowledge_hub_assignments is still the source of
// truth), same posture as sendInviteEmail in lib/organizations/actions.ts.
async function sendKnowledgeHubAssignmentEmail(
  email: string,
  contentTitle: string,
  dueDate: string | null,
  orgName: string
): Promise<void> {
  try {
    await sendEmail(
      email,
      `${orgName} assigned you training on Devometrics`,
      renderEmail({
        preheader: `${contentTitle}${dueDate ? ` — due ${dueDate}` : ""}`,
        footerNote: "You're getting this because your organization assigned you training on Devometrics.",
        bodyHtml: `
          <h2 style="color:#0A0F1E;font-size:20px;margin:0 0 16px;">New training assigned</h2>
          <p style="font-size:15px;line-height:1.7;margin:0 0 8px;">
            <strong>${escapeHtml(orgName)}</strong> assigned you <strong>${escapeHtml(contentTitle)}</strong> on Devometrics.
          </p>
          ${
            dueDate
              ? `<p style="font-size:13px;color:#8892a4;margin:0 0 24px;">Due by ${escapeHtml(dueDate)}</p>`
              : `<p style="margin:0 0 24px;"></p>`
          }
          <p style="margin:0;">
            <a href="https://devometrics.com/dashboard/knowledge-hub" style="background:#00C9A7;color:#0A0F1E;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;display:inline-block;font-size:14px;">Open Knowledge Hub →</a>
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
    if (content && company.organizationName) {
      const emailByUserId = new Map(company.rows.map((r) => [r.userId, r.email]));
      await Promise.allSettled(
        newlyAssignedIds
          .map((id) => emailByUserId.get(id))
          .filter((email): email is string => !!email)
          .map((email) => sendKnowledgeHubAssignmentEmail(email, content.title, content.due_date, company.organizationName!))
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

export async function updateKnowledgeHubContent(
  contentId: string,
  fields: { title: string; description: string; passingScorePercent: number; dueDate: string | null }
) {
  const supabase = await createClient();
  const title = fields.title.trim();
  if (!title) return { error: "Title is required" };

  const { data, error } = await supabase
    .from("knowledge_hub_content")
    .update({
      title,
      description: fields.description.trim() || null,
      passing_score_percent: fields.passingScorePercent,
      due_date: fields.dueDate || null,
    })
    .eq("id", contentId)
    .select("id");
  if (error) {
    return { error: "Could not update this content." };
  }
  if (!data || data.length === 0) {
    return { error: "Not authorized to edit this content." };
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
  assignmentId: string;
  status: "not_started" | "completed";
  completedAt: string | null;
  scorePercent: number | null;
  passed: boolean | null;
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

  const employeeIds = (assignments ?? []).map((a) => a.employee_user_id);
  const nameByUserId = new Map(company.rows.filter((r) => employeeIds.includes(r.userId)).map((r) => [r.userId, r]));

  // Latest completion per employee — completions are append-only (full
  // re-certification history), the report shows the most recent attempt.
  const latestCompletionByEmployee = new Map<string, KnowledgeHubCompletion>();
  for (const c of completions ?? []) {
    if (!latestCompletionByEmployee.has(c.employee_user_id)) latestCompletionByEmployee.set(c.employee_user_id, c);
  }

  const rows: KnowledgeHubReportRow[] = (assignments ?? []).map((a) => {
    const person = nameByUserId.get(a.employee_user_id);
    const completion = latestCompletionByEmployee.get(a.employee_user_id);
    return {
      employeeUserId: a.employee_user_id,
      name: person?.name ?? "Unknown",
      email: person?.email ?? "",
      assignmentId: a.id,
      status: completion ? "completed" : "not_started",
      completedAt: completion?.completed_at ?? null,
      scorePercent: completion?.score_percent ?? null,
      passed: completion?.passed ?? null,
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

export type PendingKnowledgeHubItem = {
  contentId: string;
  title: string;
  dueDate: string | null;
  overdue: boolean;
};

// Feeds PendingKnowledgeHubCard on the main dashboard — everything assigned
// to the current user with no completion row yet, archived content
// excluded since it's been retired from active circulation.
export async function listMyPendingKnowledgeHub(): Promise<PendingKnowledgeHubItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: assignments } = await supabase
    .from("knowledge_hub_assignments")
    .select("content_id, knowledge_hub_content(title, due_date, archived_at)")
    .eq("employee_user_id", user.id)
    .returns<{ content_id: string; knowledge_hub_content: { title: string; due_date: string | null; archived_at: string | null } }[]>();
  if (!assignments || assignments.length === 0) return [];

  const contentIds = assignments.map((a) => a.content_id);
  const { data: completions } = await supabase
    .from("knowledge_hub_completions")
    .select("content_id")
    .eq("employee_user_id", user.id)
    .in("content_id", contentIds)
    .returns<{ content_id: string }[]>();
  const completedIds = new Set((completions ?? []).map((c) => c.content_id));

  const today = new Date().toISOString().slice(0, 10);
  return assignments
    .filter((a) => a.knowledge_hub_content && !a.knowledge_hub_content.archived_at && !completedIds.has(a.content_id))
    .map((a) => ({
      contentId: a.content_id,
      title: a.knowledge_hub_content.title,
      dueDate: a.knowledge_hub_content.due_date,
      overdue: !!a.knowledge_hub_content.due_date && a.knowledge_hub_content.due_date < today,
    }));
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
): Promise<{ error: string } | { success: true; scorePercent: number; passed: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_knowledge_hub_exam", { p_content_id: contentId, p_answers: answers });
  const rows = data as { score_percent: number; passed: boolean }[] | null;
  if (error || !rows?.[0]) return { error: error?.message ?? "Could not submit this exam" };

  revalidatePath("/dashboard/knowledge-hub");
  revalidatePath(`/dashboard/knowledge-hub/${contentId}`);
  return { success: true, scorePercent: rows[0].score_percent, passed: rows[0].passed };
}
