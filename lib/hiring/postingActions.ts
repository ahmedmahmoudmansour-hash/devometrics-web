"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { COMPETENCY_DIMENSIONS } from "@/lib/gap-analysis/dimensions";
import { suggestRoleGrading, type RoleGradingSuggestion } from "@/lib/jobArchitecture/actions";
import { MAX_JOB_DESCRIPTION_LENGTH } from "@/lib/limits";
import { callOpenRouterJson } from "@/lib/ai/openrouter";
import { assertAiBudgetOk, recordAiUsage } from "@/lib/aiUsage/track";
import type { JobPostingStatus, InterviewQuestion } from "./types";

const MAX_TITLE = 120;
const MAX_DEPARTMENT = 120;
const MAX_RESPONSIBILITIES = 4000;

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

export async function createJobPosting(input: {
  title: string;
  department?: string;
  jobDescription?: string;
  responsibilities?: string;
  linkedRoleId?: string | null;
}) {
  const { supabase, user, organizationId } = await requireAdmin();
  if (!user || !organizationId) return { error: "Not authorized" };

  const title = input.title.trim().slice(0, MAX_TITLE);
  if (!title) return { error: "Give the posting a title" };

  // If a Job Architecture role is given, confirm it actually belongs to
  // this admin's own org before linking — defense in depth on top of RLS.
  let linkedRoleId: string | null = null;
  if (input.linkedRoleId) {
    const { data: role } = await supabase
      .from("job_roles")
      .select("id")
      .eq("id", input.linkedRoleId)
      .eq("organization_id", organizationId)
      .maybeSingle<{ id: string }>();
    if (role) linkedRoleId = role.id;
  }

  const { data: posting, error } = await supabase
    .from("job_postings")
    .insert({
      organization_id: organizationId,
      title,
      department: (input.department ?? "").trim().slice(0, MAX_DEPARTMENT),
      job_description: (input.jobDescription ?? "").trim().slice(0, MAX_JOB_DESCRIPTION_LENGTH),
      responsibilities: (input.responsibilities ?? "").trim().slice(0, MAX_RESPONSIBILITIES),
      linked_role_id: linkedRoleId,
      created_by: user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !posting) {
    console.error("createJobPosting failed:", error);
    return { error: "Could not create the posting — the database may need migration 0088 run first." };
  }

  revalidatePath("/dashboard/company/hiring");
  return { success: true, postingId: posting.id };
}

export async function updateJobPosting(
  postingId: string,
  fields: { title: string; department: string; jobDescription: string; responsibilities: string }
) {
  const { supabase, user, organizationId } = await requireAdmin();
  if (!user || !organizationId) return { error: "Not authorized" };

  const title = fields.title.trim().slice(0, MAX_TITLE);
  if (!title) return { error: "Give the posting a title" };

  const { error } = await supabase
    .from("job_postings")
    .update({
      title,
      department: fields.department.trim().slice(0, MAX_DEPARTMENT),
      job_description: fields.jobDescription.trim().slice(0, MAX_JOB_DESCRIPTION_LENGTH),
      responsibilities: fields.responsibilities.trim().slice(0, MAX_RESPONSIBILITIES),
      updated_at: new Date().toISOString(),
    })
    .eq("id", postingId)
    .eq("organization_id", organizationId);
  if (error) return { error: "Could not update the posting — try again." };

  revalidatePath("/dashboard/company/hiring");
  revalidatePath(`/dashboard/company/hiring/${postingId}`);
  return { success: true };
}

export async function setJobPostingStatus(postingId: string, status: JobPostingStatus) {
  const { supabase, user, organizationId } = await requireAdmin();
  if (!user || !organizationId) return { error: "Not authorized" };

  const { error } = await supabase
    .from("job_postings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", postingId)
    .eq("organization_id", organizationId);
  if (error) return { error: "Could not update status — try again." };

  revalidatePath("/dashboard/company/hiring");
  revalidatePath(`/dashboard/company/hiring/${postingId}`);
  return { success: true };
}

export async function deleteJobPosting(postingId: string) {
  const { supabase, user } = await requireAdmin();
  if (!user) return { error: "Not authorized" };

  // RLS restricts this to admins of the posting's own org — cascade removes
  // its requirements, candidates, and every candidate-scoped row beneath them.
  await supabase.from("job_postings").delete().eq("id", postingId);
  revalidatePath("/dashboard/company/hiring");
  return { success: true };
}

// Thin wrapper around Job Architecture's existing suggestRoleGrading() —
// reused directly rather than duplicating its prompt/tool. Only the
// competencyRequirements portion is meant to be persisted (via
// saveJobPostingRequirements below); grade/track/level are returned for
// on-screen context only. Decision support the admin reviews before saving,
// never auto-applied.
export async function suggestPostingRequirements(
  title: string,
  responsibilities: string
): Promise<{ error: string } | { suggestion: RoleGradingSuggestion }> {
  const { user } = await requireAdmin();
  if (!user) return { error: "Not authorized" };
  return suggestRoleGrading(title, responsibilities);
}

export async function saveJobPostingRequirements(postingId: string, requirements: { dimension: string; targetLevel: number }[]) {
  const { supabase, user, organizationId } = await requireAdmin();
  if (!user || !organizationId) return { error: "Not authorized" };

  const { data: posting } = await supabase
    .from("job_postings")
    .select("id")
    .eq("id", postingId)
    .eq("organization_id", organizationId)
    .maybeSingle<{ id: string }>();
  if (!posting) return { error: "Posting not found" };

  // Only the 8 real dimensions, clamped 0-100 — defense in depth on top of
  // the AI tool schema, same posture as createJobRole.
  const validDims = new Set<string>(COMPETENCY_DIMENSIONS);
  const rows = requirements
    .filter((r) => validDims.has(r.dimension))
    .map((r) => ({
      organization_id: organizationId,
      posting_id: postingId,
      dimension: r.dimension,
      target_level: Math.min(100, Math.max(0, Math.round(r.targetLevel))),
    }));

  await supabase.from("job_posting_competency_requirements").delete().eq("posting_id", postingId);
  if (rows.length) {
    const { error } = await supabase.from("job_posting_competency_requirements").insert(rows);
    if (error) {
      console.error("saveJobPostingRequirements failed:", error);
      return { error: "Could not save requirements — try again." };
    }
  }

  revalidatePath(`/dashboard/company/hiring/${postingId}`);
  return { success: true };
}

const INTERVIEW_QUESTIONS_TOOL = {
  name: "record_interview_questions",
  description: "Draft a competency-based interview question set for a job posting, grounded in its required competency profile.",
  input_schema: {
    type: "object" as const,
    properties: {
      questions: {
        type: "array" as const,
        minItems: 1,
        maxItems: 10,
        items: {
          type: "object" as const,
          properties: {
            dimension: { type: "string", enum: [...COMPETENCY_DIMENSIONS], description: "Which required competency this question probes." },
            question: {
              type: "string",
              description: "One behavioral, open-ended question (e.g. 'Tell me about a time you...') that surfaces real evidence for this dimension. No yes/no questions.",
            },
            whatToListenFor: {
              type: "string",
              description: "1 sentence: what a strong answer actually demonstrates, to help the interviewer judge the response — not a script, just a calibration hint.",
            },
          },
          required: ["dimension", "question", "whatToListenFor"],
        },
      },
    },
    required: ["questions"],
  },
};

// One question set per posting (not per candidate), so every candidate for
// the same role gets asked from the same baseline — closes the gap between
// "CV scored" and "manager writes free-text notes" with nothing in between
// to guide what's actually asked. Decision support only: a reference for
// the interviewer, never shown to or answered by a candidate directly, and
// never a script that must be followed verbatim.
export async function generateInterviewQuestions(postingId: string): Promise<{ error: string } | { success: true }> {
  const { supabase, user, organizationId } = await requireAdmin();
  if (!user || !organizationId) return { error: "Not authorized" };

  const { data: posting } = await supabase
    .from("job_postings")
    .select("title, job_description")
    .eq("id", postingId)
    .eq("organization_id", organizationId)
    .maybeSingle<{ title: string; job_description: string }>();
  if (!posting) return { error: "Posting not found" };

  const { data: requirements } = await supabase
    .from("job_posting_competency_requirements")
    .select("dimension, target_level")
    .eq("posting_id", postingId)
    .gt("target_level", 0)
    .order("target_level", { ascending: false })
    .returns<{ dimension: string; target_level: number }[]>();
  if (!requirements || requirements.length === 0) {
    return { error: "Set the posting's required competencies first (use \"Suggest requirements with AI\" or link a Job Architecture role)." };
  }

  const reqLines = requirements.map((r) => `${r.dimension}: target ${r.target_level}/100`).join("\n");

  const budgetCheck = await assertAiBudgetOk(supabase, { organizationId, userId: user.id });
  if (budgetCheck.error) return { error: budgetCheck.error };

  try {
    // GPT-5.4 Mini via OpenRouter — drafting-shaped, decision support only,
    // same routing rationale as generateJobDescription/suggestRoleGrading.
    const { data: raw, model, inputTokens, outputTokens } = await callOpenRouterJson<{ questions: InterviewQuestion[] }>({
      model: "openai/gpt-5.4-mini",
      maxTokens: 1500,
      system:
        "You write behavioral, competency-based interview questions for Devometrics' Smart Hiring feature. This is decision support for the interviewer, never a script to read verbatim or an automated evaluation. Write one open-ended question per required competency (STAR-style: 'tell me about a time...', 'walk me through...') that would actually surface real evidence, not a hypothetical or a yes/no question. Ask the same core questions of every candidate for a given posting — consistency across candidates is what makes notes comparable and fair. Never invent facts about the role beyond what's given.",
      user: `ROLE: ${posting.title}\n\nJOB DESCRIPTION:\n${posting.job_description || "(none provided)"}\n\nREQUIRED COMPETENCIES:\n${reqLines}`,
      jsonSchema: { name: "record_interview_questions", schema: INTERVIEW_QUESTIONS_TOOL.input_schema },
    });
    const validDims = new Set<string>(COMPETENCY_DIMENSIONS);
    const questions = (raw.questions ?? []).filter((q) => validDims.has(q.dimension) && q.question?.trim());
    if (questions.length === 0) throw new Error("Model returned no usable questions");

    const { error } = await supabase
      .from("job_postings")
      .update({ interview_questions: questions, interview_questions_generated_at: new Date().toISOString() })
      .eq("id", postingId);
    if (error) return { error: "Generated, but could not save the questions — try again." };

    await recordAiUsage(supabase, { organizationId, userId: user.id, feature: "interview_questions", model, inputTokens, outputTokens });
  } catch (err) {
    console.error("generateInterviewQuestions failed:", err);
    return { error: "Couldn't generate interview questions right now — try again in a moment." };
  }

  revalidatePath(`/dashboard/company/hiring/${postingId}`);
  return { success: true };
}
