import type { createClient } from "@/lib/supabase/server";

// Per 1M tokens, USD. Deliberately the standard/list rate (not any temporary
// intro/promotional rate) — a budget check should err toward overestimating
// real cost, never under, so a genuine spend spike is never silently missed.
// Keys must match the bare model alias, not a dated snapshot — see
// normalizeModelId below for why a raw string-equality lookup here isn't
// safe. computeCostUsd silently returns $0 for any key that still doesn't
// match after normalizing, so a typo here means usage tracking
// under-reports without ever throwing.
export const AI_USAGE_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "openai/gpt-5.4-mini": { input: 0.75, output: 4.5 },
};

// Anthropic aliases can resolve to a dated snapshot in the actual API
// response even when the alias itself has no date — confirmed live, not
// from docs: requesting "claude-haiku-4-5" comes back with
// response.model = "claude-haiku-4-5-20251001", while "claude-sonnet-5"
// round-trips exactly as requested. Without this, every Haiku-routed call
// (Coach, Roleplay, coach_grow_memory, coach_session_summary) silently
// priced at $0 forever — the exact "typo means under-reporting without
// ever throwing" risk called out above, just triggered by the API itself
// rather than a typo. Stripping a trailing -YYYYMMDD before the lookup
// means any current or future dated snapshot still matches its bare
// AI_USAGE_PRICING key.
function normalizeModelId(model: string): string {
  return model.replace(/-\d{8}$/, "");
}

export function computeCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = AI_USAGE_PRICING[normalizeModelId(model)];
  // Unknown model — log $0 rather than throw. Usage tracking must never
  // break the feature it's instrumenting.
  if (!pricing) return 0;
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

// The gated set. Extend as more call sites get wired.
export type AiUsageFeature =
  | "coach"
  | "roleplay"
  | "hiring_cv_score"
  | "coach_grow_memory"
  | "coach_session_summary"
  | "job_description"
  | "role_grading"
  | "interview_questions"
  | "career_paths"
  | "survey_questions"
  | "competency_dimension"
  | "task_breakdown"
  | "accountability_group_ai"
  | "exit_interview_analysis"
  | "flight_risk_score"
  | "gap_analysis"
  | "gap_analysis_role_context"
  | "daily_insight"
  | "note_analysis"
  | "resume_intelligence"
  | "course_recommendations"
  | "gap_analysis_bridge"
  | "candidate_interview_assessment"
  | "candidate_ranking"
  | "performance_review_ai"
  | "custom_step_ai"
  | "succession_ranking"
  | "employee_assessment_summary"
  | "case_study_scoring"
  | "career_profile_extraction"
  | "discovery_synthesis"
  | "career_gps_what_if";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Fire-and-forget from the caller's perspective — a logging failure must
// never break the actual AI feature (same "gracefully degrade" precedent as
// getDailyInsight elsewhere in this codebase).
export async function recordAiUsage(
  supabase: SupabaseServerClient,
  params: {
    organizationId: string | null;
    userId: string;
    feature: AiUsageFeature;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }
): Promise<void> {
  try {
    const costUsd = computeCostUsd(params.model, params.inputTokens, params.outputTokens);
    await supabase.from("ai_usage_events").insert({
      organization_id: params.organizationId,
      user_id: params.userId,
      feature: params.feature,
      model: params.model,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      cost_usd: costUsd,
    });
  } catch (err) {
    console.error("recordAiUsage failed (non-fatal):", err);
  }
}

// Called BEFORE an AI call on a gated feature. Fails open on any query error
// — a broken budget check must never block a real feature — and only blocks
// on a genuine, successfully-read spend >= budget.
//
// Branches on organizationId rather than being split into two functions
// (assertOrgAiBudgetOk / assertIndividualAiBudgetOk): every call site already
// resolves organizationId via getMyOrganizationMembership() (null for
// accounts with no org) and calls this unconditionally. A sibling function
// would require every call site to remember to *also* call an individual
// check, and a future call site wiring only the org-named one would silently
// reintroduce the exact bug this closes — individuals having zero
// enforcement. One function that always covers both cases structurally
// prevents that regression.
export async function assertAiBudgetOk(
  supabase: SupabaseServerClient,
  params: { organizationId: string | null; userId: string }
): Promise<{ error?: string }> {
  if (params.organizationId) {
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("monthly_ai_budget_usd")
      .eq("id", params.organizationId)
      .maybeSingle<{ monthly_ai_budget_usd: number | null }>();
    if (orgError || !org || org.monthly_ai_budget_usd === null) return {};

    const { data: spent, error: spendError } = await supabase.rpc("org_ai_spend_this_month", {
      target_org_id: params.organizationId,
    });
    if (spendError) {
      console.error("org_ai_spend_this_month failed (failing open):", spendError);
      return {};
    }

    if (Number(spent) >= org.monthly_ai_budget_usd) {
      return { error: "Your organization has reached its monthly AI usage budget. Contact your admin to increase it." };
    }
    return {};
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("monthly_ai_budget_usd")
    .eq("id", params.userId)
    .maybeSingle<{ monthly_ai_budget_usd: number | null }>();
  if (profileError || !profile || profile.monthly_ai_budget_usd === null) return {};

  const { data: spent, error: spendError } = await supabase.rpc("user_ai_spend_this_month", {
    target_user_id: params.userId,
  });
  if (spendError) {
    console.error("user_ai_spend_this_month failed (failing open):", spendError);
    return {};
  }

  if (Number(spent) >= profile.monthly_ai_budget_usd) {
    return { error: "You've reached your monthly AI usage budget. Contact support if you need this raised." };
  }
  return {};
}
