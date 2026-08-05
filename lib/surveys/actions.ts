"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateSurveyQuestions } from "./generateQuestions";
import { aggregateSurveyResponses, type QuestionAggregate } from "./aggregate";
import { getMyOrganizationMembership } from "@/lib/organizations/actions";
import { assertAiBudgetOk, recordAiUsage } from "@/lib/aiUsage/track";
import type { SurveyAnswers, SurveyQuestion } from "./types";

// AI-only, no DB writes — lets the admin review and edit the draft before
// anything is saved or assigned. A separate call from createSurvey rather
// than one combined step, since "generate" and "publish" are decisions the
// admin should get to make separately.
export async function previewSurveyQuestions(theme: string, focus?: string): Promise<{ questions: SurveyQuestion[] } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const membership = await getMyOrganizationMembership();
  const organizationId = membership?.organization_id ?? null;
  const budgetCheck = await assertAiBudgetOk(supabase, { organizationId, userId: user.id });
  if (budgetCheck.error) return { error: budgetCheck.error };

  try {
    const { questions, model, inputTokens, outputTokens } = await generateSurveyQuestions(theme, focus);
    await recordAiUsage(supabase, { organizationId, userId: user.id, feature: "survey_questions", model, inputTokens, outputTokens });
    return { questions };
  } catch {
    return { error: "Could not generate questions right now — try again." };
  }
}

export async function createSurvey(fields: {
  title: string;
  theme: string;
  questions: SurveyQuestion[];
  employeeUserIds: string[];
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!fields.title.trim()) return { error: "Give the survey a title" };
  if (fields.employeeUserIds.length === 0) return { error: "Assign it to at least one person" };
  if (fields.questions.length === 0) return { error: "Add at least one question" };
  if (fields.questions.some((q) => !q.text.trim())) return { error: "Every question needs text" };
  if (fields.questions.some((q) => q.type === "multiple_choice" && (q.options ?? []).filter((o) => o.trim()).length < 2)) {
    return { error: "Multiple-choice questions need at least 2 options" };
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .maybeSingle<{ organization_id: string; role: string }>();
  if (!membership || membership.role !== "admin") return { error: "Only org admins can create surveys" };

  const { data: survey, error: surveyError } = await supabase
    .from("surveys")
    .insert({
      organization_id: membership.organization_id,
      title: fields.title.trim(),
      theme: fields.theme,
      questions: fields.questions,
      created_by: user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (surveyError || !survey) return { error: "Could not create the survey — try again." };

  const { error: assignError } = await supabase
    .from("survey_assignments")
    .insert(fields.employeeUserIds.map((employee_user_id) => ({ survey_id: survey.id, employee_user_id })));
  if (assignError) return { error: "Survey created, but assigning it failed — try again." };

  revalidatePath("/dashboard/company/surveys");
  return { success: true, surveyId: survey.id, questionCount: fields.questions.length };
}

export type OrgSurveySummary = {
  id: string;
  title: string;
  theme: string;
  createdAt: string;
  assignedCount: number;
  responseCount: number | null;
};

export async function listOrgSurveys(): Promise<OrgSurveySummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: surveys } = await supabase
    .from("surveys")
    .select("id, title, theme, created_at")
    .order("created_at", { ascending: false })
    .returns<{ id: string; title: string; theme: string; created_at: string }[]>();
  if (!surveys) return [];
  const surveyIds = surveys.map((s) => s.id);

  // assignedCount batched into one query (grouped in JS) instead of one
  // round trip per survey. responseCount still goes through the
  // get_survey_response_count RPC per survey — that function's own
  // is_org_admin gate is what actually enforces "only admins see real
  // counts" (migration 0041), so replicating that check here in app code
  // to batch it would duplicate a security decision outside its RLS
  // boundary rather than just optimize a read.
  const [{ data: assignmentRows }, responseCounts] = await Promise.all([
    surveyIds.length
      ? supabase.from("survey_assignments").select("survey_id").in("survey_id", surveyIds).returns<{ survey_id: string }[]>()
      : Promise.resolve({ data: [] as { survey_id: string }[] }),
    Promise.all(surveys.map((s) => supabase.rpc("get_survey_response_count", { p_survey_id: s.id }))),
  ]);
  const assignedCountBySurvey = new Map<string, number>();
  for (const row of assignmentRows ?? []) {
    assignedCountBySurvey.set(row.survey_id, (assignedCountBySurvey.get(row.survey_id) ?? 0) + 1);
  }

  return surveys.map((s, i) => ({
    id: s.id,
    title: s.title,
    theme: s.theme,
    createdAt: s.created_at,
    assignedCount: assignedCountBySurvey.get(s.id) ?? 0,
    responseCount: (responseCounts[i].data as number | null) ?? 0,
  }));
}

export type SurveyResults =
  | { status: "insufficient_data"; responseCount: number }
  | { status: "ready"; title: string; responseCount: number; aggregates: QuestionAggregate[] };

export async function getSurveyResults(surveyId: string): Promise<SurveyResults | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: survey } = await supabase
    .from("surveys")
    .select("title, questions")
    .eq("id", surveyId)
    .maybeSingle<{ title: string; questions: SurveyQuestion[] }>();
  if (!survey) return { error: "Survey not found" };

  const { data: countData } = await supabase.rpc("get_survey_response_count", { p_survey_id: surveyId });
  const responseCount = (countData as number | null) ?? 0;

  const { data: rawAnswers } = await supabase.rpc("get_survey_response_values", { p_survey_id: surveyId });
  const answers = (rawAnswers as SurveyAnswers[] | null) ?? [];

  if (answers.length === 0) {
    return { status: "insufficient_data", responseCount };
  }

  return {
    status: "ready",
    title: survey.title,
    responseCount,
    aggregates: aggregateSurveyResponses(survey.questions, answers),
  };
}

export type MySurvey = {
  id: string;
  title: string;
  theme: string;
  questions: SurveyQuestion[];
};

export async function listMySurveys(): Promise<MySurvey[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: assignments } = await supabase
    .from("survey_assignments")
    .select("survey_id, surveys(id, title, theme, questions)")
    .eq("employee_user_id", user.id)
    .returns<{ survey_id: string; surveys: { id: string; title: string; theme: string; questions: SurveyQuestion[] } }[]>();
  if (!assignments) return [];

  const { data: responded } = await supabase
    .from("survey_responses")
    .select("survey_id")
    .eq("user_id", user.id)
    .returns<{ survey_id: string }[]>();
  const respondedIds = new Set((responded ?? []).map((r) => r.survey_id));

  return assignments
    .filter((a) => a.surveys && !respondedIds.has(a.survey_id))
    .map((a) => ({ id: a.surveys.id, title: a.surveys.title, theme: a.surveys.theme, questions: a.surveys.questions }));
}

export async function submitSurveyResponse(surveyId: string, answers: SurveyAnswers) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("survey_responses").insert({ survey_id: surveyId, user_id: user.id, answers });
  if (error) return { error: "Could not submit your response — try again." };

  revalidatePath("/dashboard");
  return { success: true };
}
