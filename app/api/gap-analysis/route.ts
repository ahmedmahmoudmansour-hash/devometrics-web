import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractCompetencies } from "@/lib/gap-analysis/extract";
import { inferRoleContext } from "@/lib/gap-analysis/inferRoleContext";
import { careerHealthScore } from "@/lib/gap-analysis/dimensions";
import {
  MAX_CV_LENGTH,
  MAX_JOB_DESCRIPTION_LENGTH,
  MAX_TARGET_ROLE_LENGTH,
  MAX_PERFORMANCE_DATA_LENGTH,
  GAP_ANALYSIS_RATE_LIMIT_WINDOW_MINUTES,
  GAP_ANALYSIS_RATE_LIMIT_MAX_RUNS,
} from "@/lib/limits";
import { isRateLimitExempt } from "@/lib/rateLimit/isExempt";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { targetRole, jobDescription, cvText, performanceData, consent } = (await request.json()) as {
    targetRole: string;
    jobDescription?: string;
    cvText: string;
    performanceData?: string;
    consent: boolean;
  };

  if (!targetRole?.trim() || !cvText?.trim()) {
    return NextResponse.json(
      { error: "Target role and CV are both required" },
      { status: 400 }
    );
  }
  if (!consent) {
    return NextResponse.json(
      { error: "Consent to AI analysis of your uploaded background is required" },
      { status: 400 }
    );
  }
  if (
    targetRole.length > MAX_TARGET_ROLE_LENGTH ||
    (jobDescription?.length ?? 0) > MAX_JOB_DESCRIPTION_LENGTH ||
    cvText.length > MAX_CV_LENGTH ||
    (performanceData?.length ?? 0) > MAX_PERFORMANCE_DATA_LENGTH
  ) {
    return NextResponse.json(
      {
        error: `Input too long (limits: role ${MAX_TARGET_ROLE_LENGTH}, job description ${MAX_JOB_DESCRIPTION_LENGTH}, background ${MAX_CV_LENGTH}, performance data ${MAX_PERFORMANCE_DATA_LENGTH} characters)`,
      },
      { status: 400 }
    );
  }

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
      return NextResponse.json(
        { error: "You've run several analyses recently — please wait before running another." },
        { status: 429 }
      );
    }
  }

  // No real job description pasted — infer typical responsibilities for the
  // named role instead of blocking the whole analysis on a missing paste.
  let effectiveJobDescription = jobDescription?.trim() ?? "";
  let roleContextInferred = false;
  let estimatedTimelineMonths: number | null = null;
  let timelineRationale: string | null = null;
  if (!effectiveJobDescription) {
    try {
      const inferred = await inferRoleContext(targetRole, cvText);
      effectiveJobDescription = inferred.inferredJobDescription;
      roleContextInferred = true;
      estimatedTimelineMonths = inferred.estimatedTimelineMonths;
      timelineRationale = inferred.timelineRationale;
    } catch {
      return NextResponse.json(
        { error: "Couldn't infer typical responsibilities for that role — please paste a job description instead, or try again." },
        { status: 502 }
      );
    }
  }

  let competencies;
  try {
    competencies = await extractCompetencies({ cvText, jobDescription: effectiveJobDescription, targetRole, performanceData });
  } catch {
    return NextResponse.json({ error: "Gap analysis failed — please try again" }, { status: 502 });
  }

  const score = careerHealthScore(competencies);

  const { data, error } = await supabase
    .from("gap_analyses")
    .insert({
      user_id: user.id,
      target_role: targetRole,
      job_description: effectiveJobDescription,
      cv_text: cvText,
      performance_data: performanceData || null,
      competencies,
      career_health_score: score,
      role_context_inferred: roleContextInferred,
      estimated_timeline_months: estimatedTimelineMonths,
      timeline_rationale: timelineRationale,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to save gap analysis" }, { status: 500 });
  }

  return NextResponse.json({ analysis: data });
}
