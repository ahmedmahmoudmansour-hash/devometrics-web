import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildCoachSystemPrompt } from "@/lib/coach/systemPrompt";
import { updateGrowMemory } from "@/lib/coach/growMemory";
import {
  MAX_COACH_MESSAGE_LENGTH,
  COACH_RATE_LIMIT_WINDOW_MINUTES,
  COACH_RATE_LIMIT_MAX_MESSAGES,
  COACH_FREE_MONTHLY_MESSAGE_LIMIT,
} from "@/lib/limits";
import { isRateLimitExempt } from "@/lib/rateLimit/isExempt";
import { effectiveSubscriptionTier } from "@/lib/billing/subscriptionTier";
import type {
  AssessmentResult,
  CoachGrowMemory,
  CoachMessage,
  DevelopmentPlan,
  DiscoveryProfile,
  GapAnalysis,
  Milestone,
  Profile,
  ResumeAnalysis,
} from "@/lib/supabase/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { message } = (await request.json()) as { message: string };
  if (!message?.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  if (message.length > MAX_COACH_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message is too long (max ${MAX_COACH_MESSAGE_LENGTH} characters)` },
      { status: 400 }
    );
  }

  if (!(await isRateLimitExempt(supabase, user.id))) {
    const windowStart = new Date(
      Date.now() - COACH_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000
    ).toISOString();
    const { count: recentCount } = await supabase
      .from("coach_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("role", "user")
      .gte("created_at", windowStart);
    if ((recentCount ?? 0) >= COACH_RATE_LIMIT_MAX_MESSAGES) {
      return NextResponse.json(
        { error: "You're sending messages too quickly — please wait a moment and try again." },
        { status: 429 }
      );
    }
  }

  const [
    { data: profile },
    { data: plans },
    { data: history },
    { data: gapAnalysis },
    { data: resumeAnalysis },
    { data: assessmentResults },
    { data: discoveryProfile },
    { data: growMemory },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single<Profile>(),
    supabase
      .from("development_plans")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .returns<DevelopmentPlan[]>(),
    supabase
      .from("coach_messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(40)
      .returns<CoachMessage[]>(),
    supabase
      .from("gap_analyses")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<GapAnalysis>(),
    supabase
      .from("resume_analyses")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<ResumeAnalysis>(),
    supabase
      .from("assessment_results")
      .select("*")
      .eq("user_id", user.id)
      .order("completed_at", { ascending: false })
      .returns<AssessmentResult[]>(),
    supabase
      .from("discovery_profiles")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<DiscoveryProfile>(),
    supabase.from("coach_grow_memory").select("*").eq("user_id", user.id).maybeSingle<CoachGrowMemory>(),
  ]);

  if (effectiveSubscriptionTier(profile ?? null) === "free" && !(await isRateLimitExempt(supabase, user.id))) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const { count: monthlyCount } = await supabase
      .from("coach_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("role", "user")
      .gte("created_at", monthStart.toISOString());
    if ((monthlyCount ?? 0) >= COACH_FREE_MONTHLY_MESSAGE_LIMIT) {
      return NextResponse.json(
        {
          error: `You've used all ${COACH_FREE_MONTHLY_MESSAGE_LIMIT} free coaching messages this month — upgrade to Premium for unlimited coaching.`,
        },
        { status: 403 }
      );
    }
  }

  const planIds = (plans ?? []).map((p) => p.id);
  const { data: milestones } = planIds.length
    ? await supabase
        .from("milestones")
        .select("*")
        .in("plan_id", planIds)
        .returns<Milestone[]>()
    : { data: [] as Milestone[] };

  // Keep only the latest result per assessment slug — someone may have
  // retaken one, and the coach should reference their current standing.
  const latestAssessments = Object.values(
    (assessmentResults ?? []).reduce<Record<string, AssessmentResult>>((acc, r) => {
      if (!acc[r.assessment_slug]) acc[r.assessment_slug] = r;
      return acc;
    }, {})
  );

  await supabase.from("coach_messages").insert({
    user_id: user.id,
    role: "user",
    content: message,
  });

  const systemPrompt = buildCoachSystemPrompt({
    profile: profile ?? null,
    plans: plans ?? [],
    milestones: milestones ?? [],
    gapAnalysis: gapAnalysis ?? null,
    resumeAnalysis: resumeAnalysis ?? null,
    assessmentResults: latestAssessments,
    discoveryProfile: discoveryProfile ?? null,
    growMemory: growMemory ?? null,
  });

  const conversation = [
    ...(history ?? []).map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user" as const, content: message },
  ];

  let reply: string;
  try {
    const completion = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages: conversation,
    });
    reply = completion.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
  } catch {
    return NextResponse.json(
      { error: "The coach is temporarily unavailable — please try again." },
      { status: 502 }
    );
  }

  await supabase.from("coach_messages").insert({
    user_id: user.id,
    role: "assistant",
    content: reply,
  });

  // Best-effort — a failure here shouldn't fail the whole reply the user is
  // waiting on, it just means the running GROW summary doesn't advance this
  // turn (it'll catch up next message).
  try {
    const updated = await updateGrowMemory(
      growMemory
        ? { goal: growMemory.goal ?? "", reality: growMemory.reality ?? "", options: growMemory.options ?? "", will: growMemory.will ?? "" }
        : null,
      message,
      reply
    );
    await supabase.from("coach_grow_memory").upsert({
      user_id: user.id,
      goal: updated.goal || null,
      reality: updated.reality || null,
      options: updated.options || null,
      will: updated.will || null,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Non-fatal — see comment above.
  }

  return NextResponse.json({ reply });
}
