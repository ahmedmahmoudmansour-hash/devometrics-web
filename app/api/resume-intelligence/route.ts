import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractResumeAnalysis } from "@/lib/resume/extract";
import { overallScore } from "@/lib/resume/types";
import {
  MAX_RESUME_LENGTH,
  MAX_TARGET_ROLE_LENGTH,
  RESUME_RATE_LIMIT_WINDOW_MINUTES,
  RESUME_RATE_LIMIT_MAX_RUNS,
} from "@/lib/limits";
import { isRateLimitExempt } from "@/lib/rateLimit/isExempt";
import { effectiveSubscriptionTier } from "@/lib/billing/subscriptionTier";
import type { Profile } from "@/lib/supabase/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier, premium_trial_expires_at, is_admin")
    .eq("id", user.id)
    .single<Profile>();
  if (effectiveSubscriptionTier(profile ?? null) === "free") {
    return NextResponse.json(
      { error: "Resume Intelligence is a Premium feature — upgrade to run this analysis." },
      { status: 403 }
    );
  }

  const { resumeText, targetRole, consent } = (await request.json()) as {
    resumeText: string;
    targetRole: string;
    consent: boolean;
  };

  if (!resumeText?.trim()) {
    return NextResponse.json({ error: "Resume text is required" }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json(
      { error: "Consent to AI analysis of your uploaded resume is required" },
      { status: 400 }
    );
  }
  if (resumeText.length > MAX_RESUME_LENGTH || (targetRole?.length ?? 0) > MAX_TARGET_ROLE_LENGTH) {
    return NextResponse.json(
      {
        error: `Input too long (limits: resume ${MAX_RESUME_LENGTH}, target role ${MAX_TARGET_ROLE_LENGTH} characters)`,
      },
      { status: 400 }
    );
  }

  if (!(await isRateLimitExempt(supabase, user.id))) {
    const windowStart = new Date(
      Date.now() - RESUME_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000
    ).toISOString();
    const { count: recentCount } = await supabase
      .from("resume_analyses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", windowStart);
    if ((recentCount ?? 0) >= RESUME_RATE_LIMIT_MAX_RUNS) {
      return NextResponse.json(
        { error: "You've run several resume analyses recently — please wait before running another." },
        { status: 429 }
      );
    }
  }

  let result;
  try {
    result = await extractResumeAnalysis({ resumeText, targetRole: targetRole || null });
  } catch {
    return NextResponse.json({ error: "Resume analysis failed — please try again" }, { status: 502 });
  }

  const overall = overallScore(result);

  const { data, error } = await supabase
    .from("resume_analyses")
    .insert({
      user_id: user.id,
      target_role: targetRole || null,
      resume_text: resumeText,
      ats_score: result.atsScore,
      achievement_score: result.achievementScore,
      overall_score: overall,
      matched_keywords: result.matchedKeywords,
      missing_keywords: result.missingKeywords,
      ats_issues: result.atsIssues,
      weak_bullets: result.weakBullets,
      visibility_recommendations: result.visibilityRecommendations,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to save resume analysis" }, { status: 500 });
  }

  return NextResponse.json({ analysis: data });
}
