import { ASSESSMENTS } from "@/lib/assessments/catalog";
import { ROLEPLAY_SCENARIOS } from "@/lib/roleplay/scenarios";
import { computePromotionReadiness, computeInterviewReadiness } from "./readiness";
import type { CompetencyScore } from "@/lib/gap-analysis/dimensions";
import type { GapAnalysis, Milestone } from "@/lib/supabase/types";

export type GpsRouteAction = {
  label: string;
  href: string;
};

export type CareerGpsSnapshot = {
  destination: string;
  promotionReadiness: number;
  interviewReadiness: number | null;
  topGaps: { dimension: string; gapSize: number }[];
  fastestRoute: GpsRouteAction[];
  estimatedReadinessAfter: number | null;
};

// Pure computation over data the dashboard already fetches — no extra AI
// call, no extra DB round trip beyond the one isolated roleplay-completion
// check the caller passes in. "Fastest route" and "estimated readiness
// after" are grounded, documented estimates (stated plainly in the UI),
// not a confident prediction: completing the top-gap dimension's suggested
// actions is assumed to close that one dimension's gap by a flat 15 points,
// capped at its target — a stated assumption, not invented precision.
const ASSUMED_GAP_CLOSE_PER_ACTION = 15;

export function buildCareerGpsSnapshot(
  analysis: GapAnalysis,
  milestones: Milestone[],
  completedAssessmentSlugs: Set<string>,
  hasCompletedJobInterviewScenario: boolean
): CareerGpsSnapshot {
  const competencies = analysis.competencies;
  const promotionReadiness = computePromotionReadiness(competencies) ?? 0;
  const interviewReadiness = computeInterviewReadiness(competencies, hasCompletedJobInterviewScenario);

  const sortedByGap = [...competencies].sort((a, b) => b.gapSize - a.gapSize);
  const topGaps = sortedByGap.slice(0, 3).map((c) => ({ dimension: c.dimension, gapSize: c.gapSize }));
  const topGapDimension = sortedByGap[0]?.dimension ?? null;

  const fastestRoute: GpsRouteAction[] = [];

  const nextMilestone = milestones
    .filter((m) => !m.completed)
    .sort((a, b) => a.position - b.position)[0];
  if (nextMilestone) {
    fastestRoute.push({ label: `Complete: ${nextMilestone.title}`, href: "/dashboard/plans" });
  }

  if (topGapDimension) {
    const matchingAssessment = ASSESSMENTS.find(
      (a) => a.dimension === topGapDimension && !completedAssessmentSlugs.has(a.slug)
    );
    if (matchingAssessment) {
      fastestRoute.push({ label: `Take the ${matchingAssessment.name} assessment`, href: "/dashboard/assessments" });
    }

    const matchingScenario = ROLEPLAY_SCENARIOS.find((s) =>
      s.competencyFocus.some((f) => f.toLowerCase().includes(topGapDimension.toLowerCase()))
    );
    if (matchingScenario) {
      fastestRoute.push({ label: `Practice: ${matchingScenario.title}`, href: `/dashboard/roleplay/${matchingScenario.slug}` });
    } else if (!hasCompletedJobInterviewScenario) {
      fastestRoute.push({ label: "Practice: The Job Interview", href: "/dashboard/roleplay/job-interview" });
    }
  }

  const estimatedReadinessAfter = topGapDimension
    ? (() => {
        const projected: CompetencyScore[] = competencies.map((c) =>
          c.dimension === topGapDimension
            ? { ...c, currentLevel: Math.min(c.targetLevel, c.currentLevel + ASSUMED_GAP_CLOSE_PER_ACTION) }
            : c
        );
        return computePromotionReadiness(projected);
      })()
    : null;

  return {
    destination: analysis.target_role,
    promotionReadiness,
    interviewReadiness,
    topGaps,
    fastestRoute: fastestRoute.slice(0, 3),
    estimatedReadinessAfter,
  };
}
