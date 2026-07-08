import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getRoleplayScenario } from "@/lib/roleplay/scenarios";
import { getCustomScenario } from "@/lib/roleplay/customScenarios";
import { buildRoleplaySystemPrompt } from "@/lib/roleplay/systemPrompt";
import { ASSESSMENTS } from "@/lib/assessments/catalog";
import {
  MAX_ROLEPLAY_MESSAGE_LENGTH,
  ROLEPLAY_SESSION_RATE_LIMIT_WINDOW_MINUTES,
  ROLEPLAY_SESSION_RATE_LIMIT_MAX_NEW_SESSIONS,
  MAX_ROLEPLAY_TURNS,
} from "@/lib/limits";
import { isRateLimitExempt } from "@/lib/rateLimit/isExempt";
import { effectiveSubscriptionTier } from "@/lib/billing/subscriptionTier";
import type { AssessmentResult, Profile, RoleplayMessage, RoleplaySession } from "@/lib/supabase/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
    .select("*")
    .eq("id", user.id)
    .single<Profile>();
  if (effectiveSubscriptionTier(profile ?? null) === "free") {
    return NextResponse.json(
      { error: "The Interview Simulator is a Premium feature — upgrade to practice scenarios." },
      { status: 403 }
    );
  }

  const { scenarioSlug, sessionId, message, endScenario } = (await request.json()) as {
    scenarioSlug: string;
    sessionId?: string;
    message: string;
    endScenario?: boolean;
  };

  const scenario = getRoleplayScenario(scenarioSlug) ?? (await getCustomScenario(scenarioSlug, user.id));
  if (!scenario) {
    return NextResponse.json({ error: "Unknown scenario" }, { status: 400 });
  }
  if (!message?.trim()) {
    return NextResponse.json({ error: "A message is required" }, { status: 400 });
  }
  if (message.length > MAX_ROLEPLAY_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message too long (max ${MAX_ROLEPLAY_MESSAGE_LENGTH} characters)` },
      { status: 400 }
    );
  }

  let session: RoleplaySession | null = null;
  if (sessionId) {
    const { data } = await supabase
      .from("roleplay_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single<RoleplaySession>();
    session = data ?? null;
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
  } else {
    if (!(await isRateLimitExempt(supabase, user.id))) {
      const windowStart = new Date(
        Date.now() - ROLEPLAY_SESSION_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000
      ).toISOString();
      const { count: recentSessions } = await supabase
        .from("roleplay_sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", windowStart);
      if ((recentSessions ?? 0) >= ROLEPLAY_SESSION_RATE_LIMIT_MAX_NEW_SESSIONS) {
        return NextResponse.json(
          { error: "You've started several scenarios recently — please wait before starting another." },
          { status: 429 }
        );
      }
    }

    const { data: created } = await supabase
      .from("roleplay_sessions")
      .insert({ user_id: user.id, scenario_slug: scenarioSlug, messages: [] })
      .select()
      .single<RoleplaySession>();
    session = created ?? null;
    if (!session) {
      return NextResponse.json({ error: "Could not start scenario" }, { status: 500 });
    }
  }

  if (session.messages.length >= MAX_ROLEPLAY_TURNS) {
    return NextResponse.json(
      { error: "This scenario has run its full length — start a new one to keep practicing." },
      { status: 400 }
    );
  }

  const relevantSlugs = ASSESSMENTS.filter((a) => scenario.competencyFocus.includes(a.name)).map(
    (a) => a.slug
  );
  const { data: assessmentResults } = relevantSlugs.length
    ? await supabase
        .from("assessment_results")
        .select("*")
        .eq("user_id", user.id)
        .in("assessment_slug", relevantSlugs)
        .order("completed_at", { ascending: false })
        .returns<AssessmentResult[]>()
    : { data: [] as AssessmentResult[] };

  const latestBySlug = new Map<string, AssessmentResult>();
  for (const r of assessmentResults ?? []) {
    if (!latestBySlug.has(r.assessment_slug)) latestBySlug.set(r.assessment_slug, r);
  }

  const userMessage = endScenario
    ? `${message}\n\n[The user is ending the scenario now — give the full feedback summary as instructed, not another in-character reply.]`
    : message;

  const conversation: RoleplayMessage[] = [
    ...session.messages,
    { role: "user", content: userMessage },
  ];

  const systemPrompt = buildRoleplaySystemPrompt({
    scenario,
    profile: profile ?? null,
    relevantAssessments: Array.from(latestBySlug.values()),
  });

  let reply: string;
  try {
    const completion = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages:
        conversation.length === 1
          ? [{ role: "user", content: `${scenario.openingMessage}\n\n${userMessage}` }]
          : conversation,
    });
    reply = completion.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
  } catch {
    return NextResponse.json({ error: "The scenario is temporarily unavailable — please try again." }, { status: 502 });
  }

  const finalMessages: RoleplayMessage[] = [...conversation, { role: "assistant", content: reply }];

  const { data: updated } = await supabase
    .from("roleplay_sessions")
    .update({
      messages: finalMessages,
      updated_at: new Date().toISOString(),
      ...(endScenario ? { completed: true, feedback: reply } : {}),
    })
    .eq("id", session.id)
    .select()
    .single<RoleplaySession>();

  return NextResponse.json({ session: updated, reply });
}
