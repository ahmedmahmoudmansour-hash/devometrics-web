import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAssessment } from "@/lib/assessments/catalog";
import { getCaseStudy } from "@/lib/assessments/caseStudies";
import { scoreOpenCaseStudy } from "@/lib/assessments/scoreOpenCaseStudy";
import {
  MAX_CASE_STUDY_RESPONSE_LENGTH,
  CASE_STUDY_RATE_LIMIT_WINDOW_MINUTES,
  CASE_STUDY_RATE_LIMIT_MAX_RUNS,
} from "@/lib/limits";
import { isRateLimitExempt } from "@/lib/rateLimit/isExempt";
import { getMyOrganizationMembership } from "@/lib/organizations/actions";
import { assertAiBudgetOk, recordAiUsage } from "@/lib/aiUsage/track";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { assessmentSlug, caseStudyId, responseText } = (await request.json()) as {
    assessmentSlug: string;
    caseStudyId: string;
    responseText: string;
  };

  const assessment = getAssessment(assessmentSlug);
  if (!assessment) {
    return NextResponse.json({ error: "Unknown assessment" }, { status: 400 });
  }
  const caseStudy = getCaseStudy(assessmentSlug, caseStudyId);
  if (!caseStudy || caseStudy.type !== "open") {
    return NextResponse.json({ error: "Unknown case study" }, { status: 400 });
  }
  if (!responseText?.trim()) {
    return NextResponse.json({ error: "A response is required" }, { status: 400 });
  }
  if (responseText.length > MAX_CASE_STUDY_RESPONSE_LENGTH) {
    return NextResponse.json(
      { error: `Response too long (max ${MAX_CASE_STUDY_RESPONSE_LENGTH} characters)` },
      { status: 400 }
    );
  }

  if (!(await isRateLimitExempt(supabase, user.id))) {
    const windowStart = new Date(
      Date.now() - CASE_STUDY_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000
    ).toISOString();
    const { count: recentCount } = await supabase
      .from("assessment_results")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("completed_at", windowStart);
    if ((recentCount ?? 0) >= CASE_STUDY_RATE_LIMIT_MAX_RUNS) {
      return NextResponse.json(
        { error: "You've completed several assessments recently — please wait before running more." },
        { status: 429 }
      );
    }
  }

  const membership = await getMyOrganizationMembership();
  const organizationId = membership?.organization_id ?? null;
  const budgetCheck = await assertAiBudgetOk(supabase, { organizationId, userId: user.id });
  if (budgetCheck.error) {
    return NextResponse.json({ error: budgetCheck.error }, { status: 402 });
  }

  try {
    const result = await scoreOpenCaseStudy({
      assessmentName: assessment.name,
      scenario: caseStudy.scenario,
      prompt: caseStudy.prompt,
      responseText,
      onUsage: (usage) => recordAiUsage(supabase, { organizationId, userId: user.id, feature: "case_study_scoring", ...usage }),
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Case study scoring failed — please try again" }, { status: 502 });
  }
}
