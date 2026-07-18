import type { CompetencyScore } from "@/lib/gap-analysis/dimensions";

// Importance-weighted average of how close each dimension's measured
// current level is to what the target role requires. Same signal Career
// Paths generates per-node via a full AI call, computed here deterministic-
// ally and live from the same stored Gap Analysis competencies instead —
// so it updates the instant a new Gap Analysis or milestone changes the
// underlying numbers, with no AI cost on every dashboard load.
export function computePromotionReadiness(competencies: CompetencyScore[]): number | null {
  if (competencies.length === 0) return null;
  const totalWeight = competencies.reduce((sum, c) => sum + c.importance, 0);
  if (totalWeight === 0) return null;
  const weightedReadiness = competencies.reduce((sum, c) => {
    const ratio = c.targetLevel > 0 ? Math.min(1, c.currentLevel / c.targetLevel) : 1;
    return sum + ratio * c.importance;
  }, 0);
  return Math.round((weightedReadiness / totalWeight) * 100);
}

// Blends measured Communication competency (real Gap Analysis data) with
// whether they've actually run the Job Interview practice scenario —
// completing it is real, in-app evidence of interview practice, not a
// self-report claim.
export function computeInterviewReadiness(
  competencies: CompetencyScore[],
  hasCompletedJobInterviewScenario: boolean
): number | null {
  const communication = competencies.find((c) => c.dimension === "Communication");
  if (!communication) return null;
  const practiceComponent = hasCompletedJobInterviewScenario ? 100 : 35;
  return Math.round(0.65 * communication.currentLevel + 0.35 * practiceComponent);
}
