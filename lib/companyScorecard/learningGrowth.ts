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

export function computeLearningGrowthMetrics(data: CompanyData): LearningGrowthMetric[] {
  const rows = data.rows;
  const total = rows.length;
  if (total === 0) {
    return [
      { label: "Gap Analysis coverage", value: "—", detail: "No team members yet", percent: null },
      { label: "Assessment participation", value: "—", detail: "No team members yet", percent: null },
      { label: "Average Career Health Score", value: "—", detail: "No team members yet", percent: null },
      { label: "Development plan completion", value: "—", detail: "No milestones yet", percent: null },
      { label: "High Potential bench strength", value: "—", detail: "No team members yet", percent: null },
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

  return [
    {
      label: "Gap Analysis coverage",
      value: `${coveragePct}%`,
      detail: `${withGapAnalysis}/${total} employees have measured competency data`,
      percent: coveragePct,
    },
    {
      label: "Assessment participation",
      value: `${assessmentPct}%`,
      detail: `${withAssessment}/${total} employees have completed at least one assessment`,
      percent: assessmentPct,
    },
    {
      label: "Average Career Health Score",
      value: data.companyCareerHealthScore !== null ? `${data.companyCareerHealthScore}` : "—",
      detail: "Averaged across everyone who's run a Gap Analysis",
      percent: data.companyCareerHealthScore,
    },
    {
      label: "Development plan completion",
      value: planCompletionPct !== null ? `${planCompletionPct}%` : "—",
      detail:
        milestonesTotal > 0
          ? `${milestonesDone}/${milestonesTotal} milestones complete across the org`
          : "No milestones created yet",
      percent: planCompletionPct,
    },
    {
      label: "High Potential bench strength",
      value: `${benchCount}`,
      detail: "Employees in the top growth-signal row of the talent grid — see High Potential Pool",
      percent: null,
    },
  ];
}
