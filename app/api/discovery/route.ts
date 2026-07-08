import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { synthesizeDiscoveryProfile } from "@/lib/discovery/synthesize";
import { DISCOVERY_QUESTIONS, type DiscoveryAnswer } from "@/lib/discovery/questions";
import {
  MAX_DISCOVERY_ANSWER_LENGTH,
  DISCOVERY_RATE_LIMIT_WINDOW_MINUTES,
  DISCOVERY_RATE_LIMIT_MAX_RUNS,
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

  const { answers, consent } = (await request.json()) as {
    answers: DiscoveryAnswer[];
    consent: boolean;
  };

  if (!consent) {
    return NextResponse.json(
      { error: "Consent to AI analysis of your answers is required" },
      { status: 400 }
    );
  }
  if (
    !Array.isArray(answers) ||
    answers.length !== DISCOVERY_QUESTIONS.length ||
    answers.some((a) => !a.answer?.trim() || a.answer.length > MAX_DISCOVERY_ANSWER_LENGTH)
  ) {
    return NextResponse.json(
      { error: `All ${DISCOVERY_QUESTIONS.length} questions must be answered (max ${MAX_DISCOVERY_ANSWER_LENGTH} characters each)` },
      { status: 400 }
    );
  }

  if (!(await isRateLimitExempt(supabase, user.id))) {
    const windowStart = new Date(
      Date.now() - DISCOVERY_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000
    ).toISOString();
    const { count: recentCount } = await supabase
      .from("discovery_profiles")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", windowStart);
    if ((recentCount ?? 0) >= DISCOVERY_RATE_LIMIT_MAX_RUNS) {
      return NextResponse.json(
        { error: "You've run the discovery interview recently — please wait before running it again." },
        { status: 429 }
      );
    }
  }

  let summary: string;
  try {
    summary = await synthesizeDiscoveryProfile(answers);
  } catch {
    return NextResponse.json({ error: "Discovery synthesis failed — please try again" }, { status: 502 });
  }

  const { data, error } = await supabase
    .from("discovery_profiles")
    .insert({ user_id: user.id, answers, summary })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to save discovery profile" }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
