"use server";

import { createClient } from "@/lib/supabase/server";

export type MomentumResult =
  | { status: "insufficient_data" }
  | { status: "trend"; deltaPoints: number; deltaPercent: number; currentScore: number; daysSince: number };

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// Snapshots today's composite score once per calendar day (idempotent — a
// second call the same day is a no-op) and compares against the earliest
// snapshot within the last 30 days. Deliberately not "require a full 30 days
// of history" — the trend is shown as soon as there are 2+ days of data, so
// a new user sees movement within days instead of waiting a month for the
// feature to activate. The "over the last N days" phrasing makes the actual
// window honest either way.
export async function recordAndComputeMomentum(compositeScore: number | null): Promise<MomentumResult> {
  if (compositeScore === null) return { status: "insufficient_data" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "insufficient_data" };

  const todayStart = new Date().toISOString().slice(0, 10) + "T00:00:00.000Z";
  const { data: todaySnapshot } = await supabase
    .from("career_health_snapshots")
    .select("id")
    .eq("user_id", user.id)
    .gte("recorded_at", todayStart)
    .limit(1)
    .maybeSingle();

  if (!todaySnapshot) {
    await supabase.from("career_health_snapshots").insert({ user_id: user.id, score: compositeScore });
  }

  const windowStart = new Date(Date.now() - WINDOW_MS).toISOString();
  const { data: earliest } = await supabase
    .from("career_health_snapshots")
    .select("score, recorded_at")
    .eq("user_id", user.id)
    .gte("recorded_at", windowStart)
    .order("recorded_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ score: number; recorded_at: string }>();

  if (!earliest) return { status: "insufficient_data" };

  const daysSince = Math.round((Date.now() - new Date(earliest.recorded_at).getTime()) / 86_400_000);
  if (daysSince < 1) return { status: "insufficient_data" };

  const deltaPoints = compositeScore - earliest.score;
  const deltaPercent = earliest.score > 0 ? Math.round((deltaPoints / earliest.score) * 100) : 0;

  return { status: "trend", deltaPoints, deltaPercent, currentScore: compositeScore, daysSince };
}
