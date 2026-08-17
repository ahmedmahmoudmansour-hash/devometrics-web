import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getRoleplayScenario, localizeScenario } from "@/lib/roleplay/scenarios";
import { getCustomScenario } from "@/lib/roleplay/customScenarios";
import { buildRoleplaySystemPrompt } from "@/lib/roleplay/systemPrompt";
import { LOCALE_COOKIE, resolveApiLocale } from "@/lib/i18n/request";
import { ASSESSMENTS } from "@/lib/assessments/catalog";
import {
  MAX_ROLEPLAY_MESSAGE_LENGTH,
  ROLEPLAY_SESSION_RATE_LIMIT_WINDOW_MINUTES,
  ROLEPLAY_SESSION_RATE_LIMIT_MAX_NEW_SESSIONS,
  MAX_ROLEPLAY_TURNS,
} from "@/lib/limits";
import { isRateLimitExempt } from "@/lib/rateLimit/isExempt";
import { effectiveSubscriptionTier } from "@/lib/billing/subscriptionTier";
import { getMyOrganizationMembership } from "@/lib/organizations/actions";
import { listMyRestrictedFeatures } from "@/lib/organizations/featureAccess";
import { assertAiBudgetOk, recordAiUsage } from "@/lib/aiUsage/track";
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
  const membership = await getMyOrganizationMembership();
  if (effectiveSubscriptionTier(profile ?? null, !!membership) === "free") {
    return NextResponse.json(
      { error: "The Interview Simulator is a Premium feature — upgrade to practice scenarios." },
      { status: 403 }
    );
  }
  const restricted = await listMyRestrictedFeatures(supabase, membership?.organization_id ?? null);
  if (restricted.has("roleplay")) {
    return NextResponse.json({ error: "Roleplay practice has been restricted for your account by your company administrator." }, { status: 403 });
  }

  const { scenarioSlug, sessionId, message, endScenario } = (await request.json()) as {
    scenarioSlug: string;
    sessionId?: string;
    message: string;
    endScenario?: boolean;
  };

  const rawScenario = getRoleplayScenario(scenarioSlug) ?? (await getCustomScenario(scenarioSlug, user.id));
  if (!rawScenario) {
    return NextResponse.json({ error: "Unknown scenario" }, { status: 400 });
  }
  // Route Handlers don't go through next-intl's own request-locale
  // resolution (see lib/i18n/request.ts) — resolveApiLocale is the same
  // cookie/profile-fallback logic the LANGUAGE instruction below uses, so
  // getTranslations here reads the exact locale the model is being told to
  // reply in. Without this, the scenario's English setup/opening line went
  // into the prompt even in Arabic mode — the model was told "respond
  // entirely in Arabic" while reading English scene-setting, which is what
  // caused replies to code-switch instead of staying fully Arabic.
  const locale = resolveApiLocale((await cookies()).get(LOCALE_COOKIE)?.value, profile?.language);
  const tScenario = await getTranslations({ locale, namespace: "roleplayScenarios" });
  const scenario = localizeScenario(rawScenario, tScenario);
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

  const organizationId = membership?.organization_id ?? null;
  const budgetCheck = await assertAiBudgetOk(supabase, { organizationId, userId: user.id });
  if (budgetCheck.error) {
    return NextResponse.json({ error: budgetCheck.error }, { status: 403 });
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
    locale,
  });

  // Streamed like the Coach route: text deltas reach the client as Claude
  // produces them instead of waiting for the full in-character reply (which
  // for a roleplay scenario can run long) before anything happens. This was
  // the single biggest latency gap between Roleplay and Coach — Coach was
  // streamed, this route wasn't.
  // Haiku 4.5 — same routing decision as Coach (app/api/coach/route.ts):
  // measured cheaper, faster, and more consistent than Sonnet across 10
  // distinct real conversation scenarios this session, and this is
  // conversational rather than scored, so the calibration gap that keeps
  // scoring features on Sonnet doesn't apply.
  const stream = anthropic.messages.stream({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: systemPrompt,
    messages:
      conversation.length === 1
        ? [{ role: "user", content: `${scenario.openingMessage}\n\n${userMessage}` }]
        : conversation,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let reply = "";
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            reply += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        console.error("roleplay stream failed:", err);
        if (!reply) {
          controller.enqueue(
            encoder.encode("The scenario is temporarily unavailable — please try again.")
          );
        }
        controller.close();
        return;
      }

      controller.close();
      if (!reply) return;

      const finalMessages: RoleplayMessage[] = [...conversation, { role: "assistant", content: reply }];
      await supabase
        .from("roleplay_sessions")
        .update({
          messages: finalMessages,
          updated_at: new Date().toISOString(),
          ...(endScenario ? { completed: true, feedback: reply } : {}),
        })
        .eq("id", session.id);

      // Best-effort — usage logging must never affect the reply already
      // delivered to the user.
      try {
        const finalMessage = await stream.finalMessage();
        await recordAiUsage(supabase, {
          organizationId,
          userId: user.id,
          feature: "roleplay",
          model: finalMessage.model,
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
        });
      } catch (err) {
        console.error("roleplay usage recording failed (non-fatal):", err);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      // Client needs the session id (a new scenario's first turn creates
      // it) before the stream finishes, to persist it for the next turn.
      "X-Session-Id": session.id,
    },
  });
}
