import { createClient } from "@/lib/supabase/server";
import { resolveAssessmentName } from "@/lib/assessments/catalog";
import type { CompetencyDimension } from "@/lib/gap-analysis/dimensions";
import type { AssessmentResult, GapAnalysis, Milestone, ResumeAnalysis } from "@/lib/supabase/types";

export type TrendPoint = { date: string; score: number };

export type DimensionMovement = {
  dimension: CompetencyDimension;
  current: number;
  previous: number | null;
  delta: number | null;
};

export type AssessmentTrend = {
  slug: string;
  name: string;
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

// Self-benchmarking only — comparing a user against their own history, using
// data already collected. Deliberately does NOT compare against other users
// or a market average: with a pilot cohort this small, a percentile claim
// would be statistically meaningless, the same reasoning that killed the
// Salary Benchmark feature. Revisit peer comparison once the cohort is large
// enough for a percentile to mean something real.
export async function buildScorecard(): Promise<ScorecardData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: analyses }, { data: assessmentResults }, { data: resumeAnalyses }, { data: plans }] =
    await Promise.all([
      supabase
        .from("gap_analyses")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .returns<GapAnalysis[]>(),
      supabase
        .from("assessment_results")
        .select("*")
        .eq("user_id", user.id)
        .order("completed_at", { ascending: true })
        .returns<AssessmentResult[]>(),
      supabase
        .from("resume_analyses")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .returns<ResumeAnalysis[]>(),
      supabase.from("development_plans").select("*").eq("user_id", user.id).returns<{ id: string }[]>(),
    ]);

  const planIds = (plans ?? []).map((p) => p.id);
  const { data: milestones } = planIds.length
    ? await supabase.from("milestones").select("*").in("plan_id", planIds).returns<Milestone[]>()
    : { data: [] as Milestone[] };

  const careerHealthHistory: TrendPoint[] = (analyses ?? []).map((a) => ({
    date: a.created_at,
    score: a.career_health_score,
  }));
  const careerHealthDelta =
    careerHealthHistory.length >= 2
      ? careerHealthHistory[careerHealthHistory.length - 1].score - careerHealthHistory[careerHealthHistory.length - 2].score
      : null;

  const dimensionMovement: DimensionMovement[] = [];
  if ((analyses ?? []).length > 0) {
    const latest = analyses![analyses!.length - 1];
    const prior = analyses!.length >= 2 ? analyses![analyses!.length - 2] : null;
    for (const c of latest.competencies) {
      const priorScore = prior?.competencies.find((p) => p.dimension === c.dimension);
      dimensionMovement.push({
        dimension: c.dimension,
        current: c.currentLevel,
        previous: priorScore?.currentLevel ?? null,
        delta: priorScore ? c.currentLevel - priorScore.currentLevel : null,
      });
    }
  }

  const resumeHistory: TrendPoint[] = (resumeAnalyses ?? []).map((r) => ({
    date: r.created_at,
    score: r.overall_score,
  }));
  const resumeDelta =
    resumeHistory.length >= 2 ? resumeHistory[resumeHistory.length - 1].score - resumeHistory[resumeHistory.length - 2].score : null;

  const bySlug = new Map<string, TrendPoint[]>();
  for (const r of assessmentResults ?? []) {
    const list = bySlug.get(r.assessment_slug) ?? [];
    list.push({ date: r.completed_at, score: r.score });
    bySlug.set(r.assessment_slug, list);
  }
  const assessmentTrends: AssessmentTrend[] = Array.from(bySlug.entries()).map(([slug, history]) => ({
    slug,
    name: resolveAssessmentName(slug),
    history,
    delta: history.length >= 2 ? history[history.length - 1].score - history[history.length - 2].score : null,
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
