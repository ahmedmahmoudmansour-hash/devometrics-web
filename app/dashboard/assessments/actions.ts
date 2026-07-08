"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { effectiveSubscriptionTier } from "@/lib/billing/subscriptionTier";
import { FREE_ASSESSMENT_LIMIT } from "@/lib/limits";
import type { CaseStudyResponse, Profile } from "@/lib/supabase/types";

export async function saveAssessmentResult(
  slug: string,
  score: number,
  answers: number[],
  caseStudyResponses: CaseStudyResponse[] = [],
  caseStudyInsight: string | null = null
) {
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
    const { data: existing } = await supabase
      .from("assessment_results")
      .select("assessment_slug")
      .eq("user_id", user.id);
    const distinctSlugs = new Set((existing ?? []).map((r) => r.assessment_slug));
    // Retaking an already-completed assessment never counts against the
    // cap — only finishing a *new* one does.
    if (!distinctSlugs.has(slug) && distinctSlugs.size >= FREE_ASSESSMENT_LIMIT) {
      return {
        error: `Free accounts get ${FREE_ASSESSMENT_LIMIT} assessments — upgrade to Premium for all of them.`,
      };
    }
  }

  await supabase.from("assessment_results").insert({
    user_id: user.id,
    assessment_slug: slug,
    score,
    answers,
    case_study_responses: caseStudyResponses,
    case_study_insight: caseStudyInsight,
  });
  revalidatePath("/dashboard/assessments");
  revalidatePath(`/dashboard/assessments/${slug}`);
}
