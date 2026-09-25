import { createClient } from "@/lib/supabase/server";
import type { CompetencyDimension } from "@/lib/gap-analysis/dimensions";
import type { Milestone } from "@/lib/supabase/types";
import { getScoreHistoryForEmployee, groupScoreHistoryIntoMoments } from "@/lib/scoring/scoreEvents";

export type TrendPoint = { date: string; score: number };

export type DimensionMovement = {
  dimension: CompetencyDimension;
  current: number;
  previous: number | null;
  delta: number | null;
};

// No display "name" field here — the caller resolves the translated name
// from `slug` via resolveAssessmentDisplayName(), same as everywhere else
// this pattern is used (this is a lib/ pure function; it has no translator).
export type AssessmentTrend = {
  slug: string;
  history: TrendPoint[];
  delta: number | null;
};

export type ScorecardData = {
  hasAnyData: boolean;
  careerHealthHistory: TrendPoint[];
  careerHealthDelta: number | null;
  dimensionMovement: DimensionMovement[];
  resumeHistory: TrendPoint[];
  resumeDelta: number | null;
  assessmentTrends: AssessmentTrend[];
  milestonesDone: number;
  milestonesTotal: number;
};

function trailingDelta(points: TrendPoint[]): number | null {
  return points.length >= 2 ? points[points.length - 1].score - points[points.length - 2].score : null;
}

// Self-benchmarking only — comparing a user against their own history, using
// data already collected. Deliberately does NOT compare against other users
// or a market average: with a pilot cohort this small, a percentile claim
// would be statistically meaningless, the same reasoning that killed the
// Salary Benchmark feature. Revisit peer comparison once the cohort is large
// enough for a percentile to mean something real.
//
// Backed by the shared score_events layer (lib/scoring/scoreEvents.ts)
// rather than re-querying gap_analyses/assessment_results/resume_analyses
// directly and deduping in TypeScript — this used to be one of three
// independent implementations of that same pattern; see that file's header
// comment. Milestones are the one field here that isn't a "score" at all,
// so they're the one piece still queried directly.
//
// One real behavior change from the pre-migration version: careerHealthHistory
// can now include standalone career_health_snapshot events in addition to
// Gap Analysis runs (score_events tracks both as separate sources), so this
// history may be denser than it used to be — a strictly more complete trend,
// not a regression.
export async function buildScorecard(): Promise<ScorecardData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [history, { data: plans }] = await Promise.all([
    getScoreHistoryForEmployee(supabase, user.id),
    supabase.from("development_plans").select("*").eq("user_id", user.id).returns<{ id: string }[]>(),
  ]);

  const planIds = (plans ?? []).map((p) => p.id);
  const { data: milestones } = planIds.length
    ? await supabase.from("milestones").select("*").in("plan_id", planIds).returns<Milestone[]>()
    : { data: [] as Milestone[] };

  // Whole-score events only (dimension === "") — either a Gap Analysis run
  // or a standalone snapshot; see the header comment above.
  const careerHealthHistory: TrendPoint[] = history
    .filter((e) => (e.source === "gap_analysis" || e.source === "career_health_snapshot") && e.dimension === "")
    .map((e) => ({ date: e.recordedAt, score: e.rawValue }));
  const careerHealthDelta = trailingDelta(careerHealthHistory);

  // Each Gap Analysis run lands as one score_events "moment": a whole-score
  // row plus one per-dimension row per competency, sharing one
  // (sourceTable, sourceId) — groupScoreHistoryIntoMoments (also used by the
  // Employee Intelligence Timeline) collapses those back into one entry per
  // run so "latest vs. prior run" is a moments comparison, not a raw-row one.
  const gapAnalysisMoments = groupScoreHistoryIntoMoments(history.filter((e) => e.source === "gap_analysis"));
  const dimensionMovement: DimensionMovement[] = [];
  if (gapAnalysisMoments.length > 0) {
    const latest = gapAnalysisMoments[gapAnalysisMoments.length - 1];
    const prior = gapAnalysisMoments.length >= 2 ? gapAnalysisMoments[gapAnalysisMoments.length - 2] : null;
    for (const detail of latest.details) {
      if (detail.dimension === "") continue; // the whole-score row, not a per-dimension one
      const priorDetail = prior?.details.find((d) => d.dimension === detail.dimension);
      dimensionMovement.push({
        dimension: detail.dimension as CompetencyDimension,
        current: detail.rawValue,
        previous: priorDetail?.rawValue ?? null,
        delta: priorDetail ? detail.rawValue - priorDetail.rawValue : null,
      });
    }
  }

  const resumeHistory: TrendPoint[] = history
    .filter((e) => e.source === "resume_analysis")
    .map((e) => ({ date: e.recordedAt, score: e.rawValue }));
  const resumeDelta = trailingDelta(resumeHistory);

  // Assessment slug lives in metadata, not dimension — assessment_result
  // events are recorded with dimension = "" and the slug stashed as
  // metadata.assessment_slug (migration 0147/0148).
  const bySlug = new Map<string, TrendPoint[]>();
  for (const e of history) {
    if (e.source !== "assessment_result") continue;
    const slug = e.metadata.assessment_slug;
    if (typeof slug !== "string") continue;
    const list = bySlug.get(slug) ?? [];
    list.push({ date: e.recordedAt, score: e.rawValue });
    bySlug.set(slug, list);
  }
  const assessmentTrends: AssessmentTrend[] = Array.from(bySlug.entries()).map(([slug, trendHistory]) => ({
    slug,
    history: trendHistory,
    delta: trailingDelta(trendHistory),
  }));

  const milestonesTotal = (milestones ?? []).length;
  const milestonesDone = (milestones ?? []).filter((m) => m.completed).length;

  const hasAnyData =
    careerHealthHistory.length > 0 || assessmentTrends.length > 0 || resumeHistory.length > 0 || milestonesTotal > 0;

  return {
    hasAnyData,
    careerHealthHistory,
    careerHealthDelta,
    dimensionMovement,
    resumeHistory,
    resumeDelta,
    assessmentTrends,
    milestonesDone,
    milestonesTotal,
  };
}
