"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActionOptions, getDefaultAction, type LearningFormat } from "@/lib/gap-analysis/actionLibrary";
import { applyAccommodation, type Accommodation } from "@/lib/gap-analysis/accommodations";
import { freeResourceNote, showsFreeAlternative, type ResourceTier } from "@/lib/gap-analysis/freeResources";
import { bookRecommendationNote } from "@/lib/gap-analysis/bookRecommendations";
import { resourceSearchNote } from "@/lib/gap-analysis/resourceSearch";
import { rankByImpact, type CompetencyDimension } from "@/lib/gap-analysis/dimensions";
import {
  HORIZONS,
  gapCountForHorizon,
  cadenceLabelForHorizon,
  periodHours,
  budgetNote,
  successIndicator,
  targetWeekOffset,
  type Horizon,
} from "@/lib/gap-analysis/horizons";
import { inferRoleContext } from "@/lib/gap-analysis/inferRoleContext";
import { extractCompetencies } from "@/lib/gap-analysis/extract";
import { careerHealthScore } from "@/lib/gap-analysis/dimensions";
import { effectiveSubscriptionTier } from "@/lib/billing/subscriptionTier";
import {
  MAX_TARGET_ROLE_LENGTH,
  MAX_CV_LENGTH,
  GAP_ANALYSIS_RATE_LIMIT_WINDOW_MINUTES,
  GAP_ANALYSIS_RATE_LIMIT_MAX_RUNS,
} from "@/lib/limits";
import { isRateLimitExempt } from "@/lib/rateLimit/isExempt";
import { resolveAssessmentName } from "@/lib/organizations/aggregate";
import { ENGLISH_PROFICIENCY_SLUG, cefrLevelFromScore } from "@/lib/assessments/englishProficiency";
import { COGNITIVE_ABILITY_SLUG, cognitiveBandFromScore } from "@/lib/assessments/cognitiveAbility";
import { BIG_FIVE_TRAITS, bigFiveInterpretation } from "@/lib/personality/bigFive";
import type { GapAnalysis, Profile, BigFiveProfile } from "@/lib/supabase/types";

function targetDateWeeksFromNow(weeks: number): string {
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

// Backs the "quick plan" widget's optional background box with everything
// already known about the person, instead of generating from the target
// role alone whenever that box is left blank. Priority: whatever they just
// typed, plus their most recent full Gap Analysis CV text, plus their
// structured Career Profile (job history/skills/qualifications/
// aspirations), plus every completed assessment (Assessment Center,
// English Proficiency, Cognitive Reasoning) and their working-style
// context (Big Five, only if they've opted to share it — same
// self-report-sentence guardrail used for the enterprise AI report:
// interpretation text only, never raw trait scores) — combined, not
// one-or-the-other, since each can carry details the others don't. This is
// what "the plan should use everything I've told this platform" means in
// practice: the milestone selection and personalization downstream
// (extractCompetencies → generatePlanFromAnalysis) are only as complete as
// the picture handed to them here.
async function buildBackgroundContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  manualText: string
): Promise<string> {
  const parts: string[] = [];
  if (manualText.trim()) parts.push(manualText.trim());

  const { data: latestAnalysis } = await supabase
    .from("gap_analyses")
    .select("cv_text")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ cv_text: string }>();
  if (latestAnalysis?.cv_text?.trim()) parts.push(latestAnalysis.cv_text.trim());

  const { data: profile } = await supabase
    .from("profiles")
    .select("job_history, skills, qualifications, career_aspirations")
    .eq("id", userId)
    .maybeSingle<Pick<Profile, "job_history" | "skills" | "qualifications" | "career_aspirations">>();

  if (profile?.job_history?.length) {
    parts.push(
      "Job history:\n" +
        profile.job_history.map((j) => `${j.title} at ${j.company} (${j.duration}): ${j.description}`).join("\n")
    );
  }
  if (profile?.skills?.length) parts.push("Skills: " + profile.skills.join(", "));
  if (profile?.qualifications?.length) {
    parts.push(
      "Qualifications:\n" +
        profile.qualifications.map((q) => `${q.credential}, ${q.institution} (${q.year})`).join("\n")
    );
  }
  if (profile?.career_aspirations?.trim()) parts.push("Career aspirations: " + profile.career_aspirations.trim());

  // Isolated, defensive queries — a missing table/column (older database,
  // migration not yet run) degrades to "this signal just isn't included"
  // rather than breaking plan generation entirely, same pattern used
  // throughout lib/organizations/aggregate.ts.
  const { data: assessmentResults } = await supabase
    .from("assessment_results")
    .select("assessment_slug, score, completed_at")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false })
    .returns<{ assessment_slug: string; score: number; completed_at: string }[]>();
  if (assessmentResults?.length) {
    const latestBySlug = new Map<string, { assessment_slug: string; score: number }>();
    for (const r of assessmentResults) if (!latestBySlug.has(r.assessment_slug)) latestBySlug.set(r.assessment_slug, r);
    const lines = [...latestBySlug.values()].map((r) => {
      if (r.assessment_slug === ENGLISH_PROFICIENCY_SLUG) {
        return `English Proficiency: CEFR ${cefrLevelFromScore(r.score)}`;
      }
      if (r.assessment_slug === COGNITIVE_ABILITY_SLUG) {
        return `Cognitive Reasoning: ${cognitiveBandFromScore(r.score)} (self-development signal only)`;
      }
      return `${resolveAssessmentName(r.assessment_slug)}: ${r.score}/100`;
    });
    parts.push("Completed assessments:\n" + lines.join("\n"));
  }

  const { data: bigFive } = await supabase
    .from("big_five_profiles")
    .select("scores")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Pick<BigFiveProfile, "scores">>();
  if (bigFive?.scores) {
    const lines = BIG_FIVE_TRAITS.map((trait) => bigFiveInterpretation(trait, bigFive.scores[trait]));
    parts.push(
      "Working style (self-reported — use only to shape how milestones are framed, e.g. preferred learning format or pacing, never as a strength/weakness judgment):\n" +
        lines.join("\n")
    );
  }

  return parts.length > 0 ? parts.join("\n\n") : "No background details provided yet.";
}

// Applies both personalization axes to one action: accommodation reshapes
// title/description, resource tier swaps in a free/open resource note when
// the user can't pay for Premium content. Same underlying gap, same Impact
// Score ranking — genuinely different plan depending on both.
//
// subscriptionTier gates a third axis: named specifics (real book titles,
// concrete search guidance, named free platforms) are a Premium/Enterprise
// perk — a Free-plan milestone keeps the same accommodation reshaping
// (that's an accessibility need, not a paid feature) but stays at the base
// action's generic title/description, with no named content attached.
function personalize(
  action: { title: string; description: string; format: LearningFormat },
  dimension: CompetencyDimension,
  profile: Profile | null,
  subscriptionTier: Profile["subscription_tier"]
) {
  const withAccommodation = applyAccommodation(
    action,
    (profile?.accommodation as Accommodation) ?? null
  );
  if (subscriptionTier === "free") {
    return { title: withAccommodation.title, description: withAccommodation.description };
  }
  const freeNote = showsFreeAlternative(profile?.resource_tier) ? ` ${freeResourceNote(dimension)}` : "";
  const searchNote = resourceSearchNote(dimension, action.format, profile?.location ?? null);
  // Real, named books, not free-tier-gated — a library card or a used copy
  // makes these accessible regardless of resource budget, unlike the
  // paid-course formats above.
  const description = `${withAccommodation.description}${freeNote}${searchNote ? ` ${searchNote}` : ""} ${bookRecommendationNote(dimension)}`;
  return { title: withAccommodation.title, description };
}

async function topGapsForAnalysis(
  supabase: Awaited<ReturnType<typeof createClient>>,
  analysisId: string,
  userId: string,
  horizon: Horizon
) {
  const { data: analysis } = await supabase
    .from("gap_analyses")
    .select("*")
    .eq("id", analysisId)
    .eq("user_id", userId)
    .single<GapAnalysis>();
  if (!analysis) return null;

  const topGaps = rankByImpact(analysis.competencies).slice(0, gapCountForHorizon(horizon));

  return { analysis, topGaps };
}

// One-click path: auto-picks the action matching the user's stored learning
// preference, then reshapes it by accommodation and resource tier, ranked
// and paced by Impact Score, spread across the chosen horizon's real
// calendar span. Two users with an identical gap profile but different
// learning preference / accommodation / budget / horizon will get
// genuinely different plans.
export async function generatePlanFromAnalysis(analysisId: string, horizon: Horizon) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  // Server-side enforcement, not just a hidden UI option — a Free-plan
  // request for any other horizon silently gets capped to 30-day rather
  // than trusting the client to only ever ask for what it's allowed.
  const subscriptionTier = effectiveSubscriptionTier(profile ?? null);
  const effectiveHorizon: Horizon = subscriptionTier === "free" ? "30-day" : horizon;

  const result = await topGapsForAnalysis(supabase, analysisId, user.id, effectiveHorizon);
  if (!result) return { error: "Analysis not found" };
  const { analysis, topGaps } = result;

  const { data: plan } = await supabase
    .from("development_plans")
    .insert({ user_id: user.id, title: `${analysis.target_role} Personal Development Plan`, horizon: effectiveHorizon })
    .select()
    .single();
  if (!plan) return { error: "Could not create plan" };

  const tier = (profile?.resource_tier as ResourceTier | null) ?? null;
  const milestones = topGaps.map((c, i) => {
    const dimension = c.dimension as CompetencyDimension;
    const action = getDefaultAction(dimension, c.currentLevel, profile?.learning_preferences ?? null);
    const final = personalize(action, dimension, profile ?? null, subscriptionTier);
    return {
      plan_id: plan.id,
      title: final.title,
      description: `${final.description} (${c.dimension}: ${c.currentLevel} → ${c.targetLevel}, Impact Score ${c.impact})`,
      position: i,
      target_date: targetDateWeeksFromNow(targetWeekOffset(effectiveHorizon, i, topGaps.length)),
      weekly_hours: periodHours(action.format, effectiveHorizon),
      hours_period: cadenceLabelForHorizon(effectiveHorizon),
      budget_note: budgetNote(action.format, tier),
      success_indicator: successIndicator(c.dimension, c.targetLevel),
    };
  });

  if (milestones.length) {
    await supabase.from("milestones").insert(milestones);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/gap-analysis");
  return { planId: plan.id as string };
}

// Returns every format option (reading/video/hands-on/mentorship/cohort) for
// each of the top gaps at the chosen horizon, ranked by Impact Score, so the
// UI can let the user pick per-gap instead of only getting the auto-matched
// default.
export async function getPlanOptions(analysisId: string, horizon: Horizon) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const result = await topGapsForAnalysis(supabase, analysisId, user.id, horizon);
  if (!result) return null;

  return result.topGaps.map((c) => ({
    dimension: c.dimension,
    currentLevel: c.currentLevel,
    targetLevel: c.targetLevel,
    impact: c.impact,
    options: getActionOptions(c.dimension as CompetencyDimension, c.currentLevel),
  }));
}

// Creates the plan from the user's explicit per-gap format selections at the
// chosen horizon, still applying accommodation reshaping and free-resource
// substitution, preserving Impact Score order.
export async function generatePlanFromSelections(
  analysisId: string,
  targetRole: string,
  horizon: Horizon,
  selections: { dimension: CompetencyDimension; currentLevel: number; targetLevel: number; format: LearningFormat }[]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  // Same server-side cap as generatePlanFromAnalysis — a Free-plan request
  // for any other horizon is capped to 30-day regardless of what was asked.
  const subscriptionTier = effectiveSubscriptionTier(profile ?? null);
  const effectiveHorizon: Horizon = subscriptionTier === "free" ? "30-day" : horizon;

  const { data: plan } = await supabase
    .from("development_plans")
    .insert({ user_id: user.id, title: `${targetRole} Personal Development Plan`, horizon: effectiveHorizon })
    .select()
    .single();
  if (!plan) return { error: "Could not create plan" };

  const tier = (profile?.resource_tier as ResourceTier | null) ?? null;
  const milestones = selections.map((s, i) => {
    const options = getActionOptions(s.dimension, s.currentLevel);
    const chosen = options.find((o) => o.format === s.format) ?? options[0];
    const final = personalize(chosen, s.dimension, profile ?? null, subscriptionTier);
    return {
      plan_id: plan.id,
      title: final.title,
      description: `${final.description} (${s.dimension}: ${s.currentLevel} → ${s.targetLevel})`,
      position: i,
      target_date: targetDateWeeksFromNow(targetWeekOffset(effectiveHorizon, i, selections.length)),
      weekly_hours: periodHours(s.format, effectiveHorizon),
      hours_period: cadenceLabelForHorizon(effectiveHorizon),
      budget_note: budgetNote(s.format, tier),
      success_indicator: successIndicator(s.dimension, s.targetLevel),
    };
  });

  if (milestones.length) {
    await supabase.from("milestones").insert(milestones);
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/gap-analysis/${analysisId}`);
  revalidatePath("/dashboard/gap-analysis");
  return { planId: plan.id as string };
}

// The dashboard's "Start your first development plan" widget used to just
// insert a bare, empty plan (title only) — completely disconnected from the
// real AI engine that only ran from the full Gap Analysis flow. This wires
// that widget to the same real pipeline (role-inference, since this
// lightweight entry point never asks for a job description, then
// competency extraction, then milestone generation), just reachable in one
// step from the dashboard instead of requiring the longer Gap Analysis form
// first.
export async function generateQuickPlan(targetRole: string, cvText: string, horizon: Horizon) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmedRole = targetRole.trim();
  if (!trimmedRole) return { error: "Target role is required" };
  if (trimmedRole.length > MAX_TARGET_ROLE_LENGTH) {
    return { error: `Target role is too long (max ${MAX_TARGET_ROLE_LENGTH} characters)` };
  }
  if (cvText.length > MAX_CV_LENGTH) {
    return { error: `Background is too long (max ${MAX_CV_LENGTH} characters)` };
  }
  if (!(HORIZONS as readonly string[]).includes(horizon)) {
    return { error: "Invalid duration" };
  }

  // Same rate limit as the full Gap Analysis flow — this does the same
  // AI work under the hood, so it counts against the same abuse guard.
  if (!(await isRateLimitExempt(supabase, user.id))) {
    const windowStart = new Date(
      Date.now() - GAP_ANALYSIS_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000
    ).toISOString();
    const { count: recentCount } = await supabase
      .from("gap_analyses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", windowStart);
    if ((recentCount ?? 0) >= GAP_ANALYSIS_RATE_LIMIT_MAX_RUNS) {
      return { error: "You've run several analyses recently — please wait before running another." };
    }
  }

  const effectiveCvText = await buildBackgroundContext(supabase, user.id, cvText);

  let inferred;
  try {
    inferred = await inferRoleContext(trimmedRole, effectiveCvText);
  } catch {
    return { error: "Couldn't generate a plan for that role — please try again." };
  }

  let competencies;
  try {
    competencies = await extractCompetencies({
      cvText: effectiveCvText,
      jobDescription: inferred.inferredJobDescription,
      targetRole: trimmedRole,
    });
  } catch {
    return { error: "Plan generation failed — please try again." };
  }

  const { data: analysis, error: analysisError } = await supabase
    .from("gap_analyses")
    .insert({
      user_id: user.id,
      target_role: trimmedRole,
      job_description: inferred.inferredJobDescription,
      cv_text: effectiveCvText,
      performance_data: null,
      competencies,
      career_health_score: careerHealthScore(competencies),
      role_context_inferred: true,
      estimated_timeline_months: inferred.estimatedTimelineMonths,
      timeline_rationale: inferred.timelineRationale,
    })
    .select()
    .single<GapAnalysis>();
  if (analysisError || !analysis) return { error: "Could not save your plan data — please try again." };

  const planResult = await generatePlanFromAnalysis(analysis.id, horizon);
  if (planResult?.error) return { error: planResult.error };

  revalidatePath("/dashboard");
  return { success: true, planId: planResult.planId };
}
