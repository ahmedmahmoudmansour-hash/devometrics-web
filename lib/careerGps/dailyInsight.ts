"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import type { GapAnalysis } from "@/lib/supabase/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// One real, specific insight — grounded in this person's own stored data
// (dimension trend since their last Gap Analysis, or their single biggest
// current gap if there's no prior run to compare against). Never a generic
// "keep going!" — if there's nothing concrete to say, this returns null and
// the UI simply doesn't show anything, rather than manufacturing filler.
export async function getDailyInsight(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const today = todayStr();
  const { data: cached, error: cacheError } = await supabase
    .from("career_gps_daily_insights")
    .select("insight")
    .eq("user_id", user.id)
    .eq("insight_date", today)
    .maybeSingle<{ insight: string }>();
  if (cacheError) return null; // migration not run yet — degrade silently, not a page-breaking error
  if (cached) return cached.insight;

  const { data: analyses } = await supabase
    .from("gap_analyses")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(2)
    .returns<GapAnalysis[]>();
  if (!analyses || analyses.length === 0) return null;

  const [latest, previous] = analyses;

  let context: string;
  if (previous) {
    const movements = latest.competencies
      .map((c) => {
        const prior = previous.competencies.find((p) => p.dimension === c.dimension);
        return prior ? { dimension: c.dimension, delta: c.currentLevel - prior.currentLevel } : null;
      })
      .filter((m) => m !== null)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const biggestMove = movements[0];
    const topGap = [...latest.competencies].sort((a, b) => b.gapSize - a.gapSize)[0];
    context = [
      biggestMove && biggestMove.delta !== 0
        ? `Their biggest movement since their last Gap Analysis: ${biggestMove.dimension} ${biggestMove.delta > 0 ? "improved" : "dropped"} by ${Math.abs(biggestMove.delta)} points.`
        : "No dimension moved since their last Gap Analysis.",
      topGap ? `Their current biggest gap: ${topGap.dimension} (${topGap.gapSize} points short of target for "${latest.target_role}").` : "",
    ]
      .filter(Boolean)
      .join(" ");
  } else {
    const topGap = [...latest.competencies].sort((a, b) => b.gapSize - a.gapSize)[0];
    context = topGap
      ? `Their current biggest gap: ${topGap.dimension} (${topGap.gapSize} points short of target for "${latest.target_role}"), priority ${topGap.priority}.`
      : "";
  }
  if (!context.trim()) return null;

  let insight: string;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 150,
      system:
        "Write exactly one short, specific sentence (under 25 words) telling this person something genuinely useful about their own measured career data — a real movement, a real gap, or a real next step. No greetings, no generic encouragement like 'keep going', no emoji. State it as a fact or observation, not a command. Ground it strictly in the data given — never invent numbers or claims not present in the context.",
      messages: [{ role: "user", content: context }],
    });
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return null;
    insight = text.text.trim();
  } catch (err) {
    console.error("getDailyInsight generation failed:", err);
    return null;
  }
  if (!insight) return null;

  await supabase.from("career_gps_daily_insights").insert({ user_id: user.id, insight_date: today, insight });
  return insight;
}
