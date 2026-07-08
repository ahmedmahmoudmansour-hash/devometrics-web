export type WeakBullet = {
  original: string;
  issue: string;
  rewrite: string;
};

export type ResumeAnalysisResult = {
  atsScore: number; // 0-100
  atsIssues: string[];
  achievementScore: number; // 0-100
  matchedKeywords: string[];
  missingKeywords: string[];
  weakBullets: WeakBullet[];
  visibilityRecommendations: string[];
};

function clamp(n: number): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function toStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string").slice(0, max);
}

// Same defensive-clamp philosophy as gap-analysis sanitization: the tool
// schema constrains this, but never trust an LLM's numeric output as the
// only line of defense.
export function sanitizeResumeAnalysis(raw: ResumeAnalysisResult): ResumeAnalysisResult {
  const atsScore = clamp(raw.atsScore);
  const achievementScore = clamp(raw.achievementScore);
  return {
    atsScore,
    achievementScore,
    atsIssues: toStringArray(raw.atsIssues, 15),
    matchedKeywords: toStringArray(raw.matchedKeywords, 30),
    missingKeywords: toStringArray(raw.missingKeywords, 30),
    weakBullets: Array.isArray(raw.weakBullets)
      ? raw.weakBullets
          .filter(
            (b) =>
              b && typeof b.original === "string" && typeof b.issue === "string" && typeof b.rewrite === "string"
          )
          .slice(0, 20)
      : [],
    visibilityRecommendations: toStringArray(raw.visibilityRecommendations, 15),
  };
}

export function overallScore(result: ResumeAnalysisResult): number {
  return Math.round(result.atsScore * 0.5 + result.achievementScore * 0.5);
}
