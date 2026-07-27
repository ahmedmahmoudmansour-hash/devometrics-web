// The Learning & Growth perspective of the Company Scorecard — computed
// live from data this platform already has, never stored and never
// manually entered. This is the quadrant every other Balanced Scorecard
// tool struggles to fill honestly (it usually becomes a training-hours-
// logged vanity number); Devometrics can compute it directly from real
// measured competency and engagement data instead.
import type { CompanyData } from "@/lib/organizations/aggregate";
import { computeNineBoxPoint, zoneForPoint } from "@/lib/organizations/nineBox";

export type LearningGrowthMetric = {
  label: string;
  value: string;
  detail: string;
  // 0-100 for the mini bar, or null when the metric isn't a percentage
  // (bench strength is a headcount, not a rate).
  percent: number | null;
};

type Translator = (key: string, values?: Record<string, string | number>) => string;

export function computeLearningGrowthMetrics(data: CompanyData, t: Translator): LearningGrowthMetric[] {
  const rows = data.rows;
  const total = rows.length;
  if (total === 0) {
    return [
      { label: t("gapAnalysisCoverage"), value: "—", detail: t("noTeamMembersYet"), percent: null },
      { label: t("assessmentParticipation"), value: "—", detail: t("noTeamMembersYet"), percent: null },
      { label: t("averageCareerHealthScore"), value: "—", detail: t("noTeamMembersYet"), percent: null },
      { label: t("developmentPlanCompletion"), value: "—", detail: t("noMilestonesYet"), percent: null },
      { label: t("highPotentialBenchStrength"), value: "—", detail: t("noTeamMembersYet"), percent: null },
      { label: t("averagePerformanceRating"), value: "—", detail: t("noTeamMembersYet"), percent: null },
    ];
  }

  const withGapAnalysis = rows.filter((r) => Object.keys(r.dimensionLevels).length > 0).length;
  const coveragePct = Math.round((withGapAnalysis / total) * 100);

  const withAssessment = rows.filter((r) => r.assessmentsCompleted > 0).length;
  const assessmentPct = Math.round((withAssessment / total) * 100);

  const milestonesTotal = rows.reduce((a, r) => a + r.milestonesTotal, 0);
  const milestonesDone = rows.reduce((a, r) => a + r.milestonesDone, 0);
  const planCompletionPct = milestonesTotal > 0 ? Math.round((milestonesDone / milestonesTotal) * 100) : null;

  // Same top-row-of-the-9-box definition as the High Potential Pool page —
  // one consistent definition of "bench strength" everywhere it's used.
  const benchCount = rows.filter((r) => {
    const point = computeNineBoxPoint(r.dimensionLevels);
    if (!point) return false;
    return zoneForPoint(point.x, point.y).row === 2;
  }).length;

  // Manager-reported, single-source, optional — same lighter posture as
  // everywhere else performance_rating is used (see EditEmployeeButton):
  // one input among several, not a verified fact. Only averaged over
  // whoever's actually been rated, not defaulted to a middle score for the
  // rest.
  const rated = rows.filter((r) => r.performanceRating !== null);
  const avgPerformance = rated.length > 0 ? rated.reduce((a, r) => a + (r.performanceRating ?? 0), 0) / rated.length : null;

  return [
    {
      label: t("gapAnalysisCoverage"),
      value: `${coveragePct}%`,
      detail: t("gapAnalysisCoverageDetail", { measured: withGapAnalysis, total }),
      percent: coveragePct,
    },
    {
      label: t("assessmentParticipation"),
      value: `${assessmentPct}%`,
      detail: t("assessmentParticipationDetail", { measured: withAssessment, total }),
      percent: assessmentPct,
    },
    {
      label: t("averageCareerHealthScore"),
      value: data.companyCareerHealthScore !== null ? `${data.companyCareerHealthScore}` : "—",
      detail: t("averageCareerHealthScoreDetail"),
      percent: data.companyCareerHealthScore,
    },
    {
      label: t("developmentPlanCompletion"),
      value: planCompletionPct !== null ? `${planCompletionPct}%` : "—",
      detail:
        milestonesTotal > 0
          ? t("developmentPlanCompletionDetail", { done: milestonesDone, total: milestonesTotal })
          : t("noMilestonesCreatedYet"),
      percent: planCompletionPct,
    },
    {
      label: t("highPotentialBenchStrength"),
      value: `${benchCount}`,
      detail: t("highPotentialBenchStrengthDetail"),
      percent: null,
    },
    {
      label: t("averagePerformanceRating"),
      value: avgPerformance !== null ? `${avgPerformance.toFixed(1)}/5` : "—",
      detail:
        rated.length > 0
          ? t("averagePerformanceRatingDetail", { rated: rated.length, total })
          : t("noManagerRatingsYet"),
      percent: avgPerformance !== null ? Math.round((avgPerformance / 5) * 100) : null,
    },
  ];
}
