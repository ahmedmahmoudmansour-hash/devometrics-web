"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CaseStudyResponse } from "@/lib/supabase/types";

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
  if (!user) return;

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
