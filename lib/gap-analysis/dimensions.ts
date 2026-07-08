// Fixed set of competency dimensions scored by every gap analysis.
// Keeping this fixed (rather than free-form per analysis) is what makes the
// Skill Radar and Career Health Score comparable across runs over time.
export const COMPETENCY_DIMENSIONS = [
  "Technical Skills",
  "Leadership",
  "Strategic Thinking",
  "Communication",
  "AI & Digital Skills",
  "Critical Thinking",
  "People Management",
  "Financial Literacy",
] as const;

export type CompetencyDimension = (typeof COMPETENCY_DIMENSIONS)[number];

export type CompetencyScore = {
  dimension: CompetencyDimension;
  currentLevel: number; // 0-100
  targetLevel: number; // 0-100
  importance: number; // 0-100, how much this matters for the target role
  marketDemand: number; // 0-100
  gapSize: number; // targetLevel - currentLevel, 0-100
  priority: "high" | "medium" | "low";
  confidence: number; // 0-100, how confident the AI is in this specific score
  rationale: string;
};

const VALID_PRIORITIES = new Set(["high", "medium", "low"]);

function clamp(n: number): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

// Defensive clamp on AI output before it's ever stored or scored. The tool
// schema already constrains these to 0-100, but schema constraints on LLM
// tool calls are a strong steer, not a hard guarantee — this is the actual
// enforcement. gapSize is recomputed rather than trusted verbatim, so it can
// never be inconsistent with the current/target levels shown next to it.
export function sanitizeCompetencyScores(scores: CompetencyScore[]): CompetencyScore[] {
  return scores
    .filter((s) => COMPETENCY_DIMENSIONS.includes(s.dimension))
    .map((s) => {
      const currentLevel = clamp(s.currentLevel);
      const targetLevel = clamp(s.targetLevel);
      return {
        ...s,
        currentLevel,
        targetLevel,
        importance: clamp(s.importance),
        marketDemand: clamp(s.marketDemand),
        confidence: clamp(s.confidence),
        gapSize: Math.max(0, targetLevel - currentLevel),
        priority: VALID_PRIORITIES.has(s.priority) ? s.priority : "medium",
      };
    });
}

export function careerHealthScore(scores: CompetencyScore[]): number {
  if (scores.length === 0) return 0;
  const avgAttainment =
    scores.reduce((sum, s) => sum + (s.targetLevel === 0 ? 1 : s.currentLevel / s.targetLevel), 0) /
    scores.length;
  return Math.round(Math.min(avgAttainment, 1) * 100);
}

// Foundational dimensions tend to compound into the others (clear thinking
// and communication make leadership and strategy land better; technical and
// AI fluency are execution capacity everything else draws on). Used only as
// a tiebreaker in rankByImpact, never to override a clear Impact Score gap.
export const DIMENSION_TIER: Record<CompetencyDimension, "foundational" | "compounding"> = {
  "Technical Skills": "foundational",
  Communication: "foundational",
  "Critical Thinking": "foundational",
  "AI & Digital Skills": "foundational",
  Leadership: "compounding",
  "Strategic Thinking": "compounding",
  "People Management": "compounding",
  "Financial Literacy": "compounding",
};

// Impact Score: a gap only ranks high if it is simultaneously large,
// important to the target role, in demand in the market, AND the AI is
// actually confident about the underlying evidence. A huge but low-confidence
// gap (thin CV signal) is deliberately discounted rather than acted on as if
// it were certain — the Confidence Score isn't just a UI badge, it's load-bearing.
export function impactScore(score: CompetencyScore): number {
  const { gapSize, importance, marketDemand, confidence } = score;
  return Math.round(
    (gapSize / 100) * (importance / 100) * (marketDemand / 100) * (confidence / 100) * 100
  );
}

const TIEBREAK_THRESHOLD = 5; // Impact Score points within which tier sequencing decides order

export function rankByImpact(
  scores: CompetencyScore[]
): (CompetencyScore & { impact: number })[] {
  const scored = scores.map((s) => ({ ...s, impact: impactScore(s) }));
  return scored.sort((a, b) => {
    const diff = b.impact - a.impact;
    if (Math.abs(diff) > TIEBREAK_THRESHOLD) return diff;
    const aFoundational = DIMENSION_TIER[a.dimension] === "foundational" ? 0 : 1;
    const bFoundational = DIMENSION_TIER[b.dimension] === "foundational" ? 0 : 1;
    return aFoundational - bFoundational || diff;
  });
}
