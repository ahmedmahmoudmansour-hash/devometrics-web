// Reference information shown to a manager next to an appraisal competency rating: the person's latest scored role
// assessment for that competency, and what each of the five levels looks like. Pure functions, no database calls.
//
// Both are context for the manager's own judgement. They are never copied into the rating itself.

export type AssessmentReference = {
  // Standard dimension name, or the company competency id.
  key: string;
  // The level the assessment showed. If a manager overrode it, the override is the level that counts.
  level: number;
  rangeLow: number;
  rangeHigh: number;
  confidence: "low" | "medium" | "high";
  confirmed: boolean;
  overridden: boolean;
  scoredAt: string;
};

export type ReferenceBundle = {
  assessments: Record<string, AssessmentReference>;
  // Level descriptions keyed by competency key, then "1" to "5". Only non-blank descriptions are kept.
  definitions: Record<string, Record<string, string>>;
};

export const EMPTY_REFERENCES: ReferenceBundle = { assessments: {}, definitions: {} };

export type ResultRow = {
  competency_key: string;
  status: string;
  level: number | null;
  range_low: number | null;
  range_high: number | null;
  confidence: string | null;
  confirmed_at: string | null;
  override_level: number | null;
  scored_at: string;
};

// The latest scored result per competency. A result that was not assessed or failed carries no level, so it never
// replaces an earlier scored one: a person who later gave a thin answer keeps their last real result visible.
export function latestScoredPerCompetency(rows: ResultRow[]): Record<string, AssessmentReference> {
  const out: Record<string, AssessmentReference> = {};
  for (const r of rows) {
    if (r.status !== "scored" || r.level === null || r.range_low === null || r.range_high === null) continue;
    if (r.confidence !== "low" && r.confidence !== "medium" && r.confidence !== "high") continue;
    const existing = out[r.competency_key];
    if (existing && existing.scoredAt >= r.scored_at) continue;
    const overridden = r.override_level !== null;
    const level = overridden ? (r.override_level as number) : r.level;
    out[r.competency_key] = {
      key: r.competency_key,
      level,
      rangeLow: overridden ? level : r.range_low,
      rangeHigh: overridden ? level : r.range_high,
      confidence: r.confidence,
      confirmed: r.confirmed_at !== null,
      overridden,
      scoredAt: r.scored_at,
    };
  }
  return out;
}

// Keeps only the non-blank descriptions, in level order. Returns null when nothing is written.
export function cleanLevelDescriptions(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, string> = {};
  for (const level of ["1", "2", "3", "4", "5"]) {
    const v = (raw as Record<string, unknown>)[level];
    if (typeof v === "string" && v.trim()) out[level] = v.trim();
  }
  return Object.keys(out).length > 0 ? out : null;
}
