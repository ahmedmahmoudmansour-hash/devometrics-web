"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCaseStudyExercise } from "@/lib/assessments/caseStudyExercises";
import { scoreCaseStudyExercise } from "@/lib/assessments/scoreCaseStudyExercise";
import { effectiveSubscriptionTier } from "@/lib/billing/subscriptionTier";
import { isRateLimitExempt } from "@/lib/rateLimit/isExempt";
import { CASE_STUDY_RATE_LIMIT_WINDOW_MINUTES, CASE_STUDY_RATE_LIMIT_MAX_RUNS } from "@/lib/limits";
import type { Profile } from "@/lib/supabase/types";

const MAX_RESPONSE_LENGTH = 6000;

export async function startExerciseAttempt(slug: string) {
  const exercise = getCaseStudyExercise(slug);
  if (!exercise) return { error: "Unknown exercise" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier, premium_trial_expires_at, is_admin")
    .eq("id", user.id)
    .single<Profile>();
  if (effectiveSubscriptionTier(profile ?? null) === "free") {
    return { error: "Timed case-study exercises are a Premium feature — upgrade to attempt this one." };
  }

  if (!(await isRateLimitExempt(supabase, user.id))) {
    const windowStart = new Date(
      Date.now() - CASE_STUDY_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000
    ).toISOString();
    const { count: recentCount } = await supabase
      .from("case_study_exercise_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("started_at", windowStart);
    if ((recentCount ?? 0) >= CASE_STUDY_RATE_LIMIT_MAX_RUNS) {
      return { error: "You've started several exercises recently — please wait before starting another." };
    }
  }

  const { data, error } = await supabase
    .from("case_study_exercise_attempts")
    .insert({ user_id: user.id, exercise_slug: slug })
    .select()
    .single();
  if (error || !data) return { error: "Could not start this exercise — try again." };

  return { attemptId: data.id as string, startedAt: data.started_at as string };
}

export async function submitExerciseAttempt(attemptId: string, slug: string, responseText: string) {
  const exercise = getCaseStudyExercise(slug);
  if (!exercise) return { error: "Unknown exercise" };

  const trimmed = responseText.trim();
  if (!trimmed) return { error: "Write a response before submitting." };
  if (trimmed.length > MAX_RESPONSE_LENGTH) {
    return { error: `Response is too long (max ${MAX_RESPONSE_LENGTH} characters).` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  let report;
  try {
    report = await scoreCaseStudyExercise({
      dimension: exercise.dimension,
      context: exercise.context,
      prompt: exercise.prompt,
      responseText: trimmed,
    });
  } catch {
    return { error: "Scoring is temporarily unavailable — please try submitting again." };
  }

  const { data, error } = await supabase
    .from("case_study_exercise_attempts")
    .update({
      response_text: trimmed,
      submitted_at: new Date().toISOString(),
      score: report.score,
      report,
    })
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .select()
    .single();
  if (error || !data) return { error: "Could not save your submission — try again." };

  revalidatePath("/dashboard/assessments");
  return { report };
}
