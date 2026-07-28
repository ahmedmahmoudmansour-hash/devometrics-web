import type { createClient } from "@/lib/supabase/server";

// Per 1M tokens, USD. Deliberately the standard/list rate (not any temporary
// intro/promotional rate) — a budget check should err toward overestimating
// real cost, never under, so a genuine spend spike is never silently missed.
export const AI_USAGE_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 3.0, output: 15.0 },
};

export function computeCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = AI_USAGE_PRICING[model];
  // Unknown model — log $0 rather than throw. Usage tracking must never
  // break the feature it's instrumenting.
  if (!pricing) return 0;
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

// The v1 gated set — Coach, Roleplay, and Smart Hiring CV scoring, the three
// highest-volume/highest-risk paths. Extend as more call sites get wired.
export type AiUsageFeature = "coach" | "roleplay" | "hiring_cv_score";

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
// on a genuine, successfully-read spend >= budget. organizationId === null
// (individual, non-org accounts) always passes: there's no shared client
// budget to enforce.
export async function assertOrgAiBudgetOk(
  supabase: SupabaseServerClient,
  organizationId: string | null
): Promise<{ error?: string }> {
  if (!organizationId) return {};

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("monthly_ai_budget_usd")
    .eq("id", organizationId)
    .maybeSingle<{ monthly_ai_budget_usd: number | null }>();
  if (orgError || !org || org.monthly_ai_budget_usd === null) return {};

  const { data: spent, error: spendError } = await supabase.rpc("org_ai_spend_this_month", {
    target_org_id: organizationId,
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
