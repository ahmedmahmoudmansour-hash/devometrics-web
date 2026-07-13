import { createClient } from "@/lib/supabase/server";

export type ReadinessForecast =
  | { status: "insufficient_data" }
  | { status: "declining"; trendPerMonth: number }
  | { status: "forecast"; trendPerMonth: number; monthsToReady: number; readyNow: boolean };

// The Career Health Score bar a succession candidate needs to clear before
// "ready" is a data-backed claim rather than a guess. Deliberately above
// the existing teal/amber cut (70, see lib/ui/levelColor.ts) — succession
// readiness is a higher bar than "generally healthy."
const READY_THRESHOLD = 75;
// Below this many days of spread between the earliest and latest snapshot,
// a trend line is mostly noise — matches the spirit of momentum.ts's
// "show it as soon as there's real signal" stance, but succession
// forecasting is a much higher-stakes claim than a homepage trend arrow,
// so it asks for more history before speaking.
const MIN_SPREAD_DAYS = 14;
const MIN_SNAPSHOTS = 3;

// Ordinary least-squares slope over (day offset, score) pairs — more
// resistant to a single noisy day than a naive first-vs-last comparison,
// while still being a plain, auditable formula (no black-box model).
function linearTrendPerDay(points: { days: number; score: number }[]): number {
  const n = points.length;
  const meanX = points.reduce((a, p) => a + p.days, 0) / n;
  const meanY = points.reduce((a, p) => a + p.score, 0) / n;
  const numerator = points.reduce((a, p) => a + (p.days - meanX) * (p.score - meanY), 0);
  const denominator = points.reduce((a, p) => a + (p.days - meanX) ** 2, 0);
  if (denominator === 0) return 0;
  return numerator / denominator;
}

// Projects when (if ever, at the current trend) a candidate's measured
// Career Health Score reaches READY_THRESHOLD. Grounded entirely in their
// own recorded snapshot history — never a guess dressed up as a number.
// Requires the caller to already be verified as an org admin of this
// employee (RLS on career_health_snapshots enforces the same, as a second
// layer — see migration 0061).
export async function forecastReadiness(userId: string): Promise<ReadinessForecast> {
  const supabase = await createClient();
  const { data: snapshots } = await supabase
    .from("career_health_snapshots")
    .select("score, recorded_at")
    .eq("user_id", userId)
    .order("recorded_at", { ascending: true })
    .returns<{ score: number; recorded_at: string }[]>();

  if (!snapshots || snapshots.length < MIN_SNAPSHOTS) return { status: "insufficient_data" };

  const first = new Date(snapshots[0].recorded_at).getTime();
  const last = new Date(snapshots[snapshots.length - 1].recorded_at).getTime();
  const spreadDays = (last - first) / 86_400_000;
  if (spreadDays < MIN_SPREAD_DAYS) return { status: "insufficient_data" };

  const points = snapshots.map((s) => ({
    days: (new Date(s.recorded_at).getTime() - first) / 86_400_000,
    score: s.score,
  }));
  const perDay = linearTrendPerDay(points);
  const trendPerMonth = Math.round(perDay * 30 * 10) / 10;

  const currentScore = snapshots[snapshots.length - 1].score;
  if (currentScore >= READY_THRESHOLD) {
    return { status: "forecast", trendPerMonth, monthsToReady: 0, readyNow: true };
  }
  if (perDay <= 0) return { status: "declining", trendPerMonth };

  const monthsToReady = Math.ceil((READY_THRESHOLD - currentScore) / (perDay * 30));
  return { status: "forecast", trendPerMonth, monthsToReady, readyNow: false };
}
