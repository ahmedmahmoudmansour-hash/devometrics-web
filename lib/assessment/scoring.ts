// Scoring method 1.0 for role-based competency assessments (design: Scoring Method v1.0, adopted 31 Oct 2026).
//
// The AI only judges evidence: for each answer and each of a competency's five level descriptions it says how
// far the answer shows that level (0 not shown, 1 partly, 2 clearly) and quotes the person's own words. Everything
// after that is a fixed rule in this file, so the same evidence always gives the same result and every number can
// be explained. Nothing here calls a model or the database.

import { LEVEL_BANDS, PROFICIENCY_LEVELS, type ProficiencyLevel } from "@/lib/proficiency/levels";

export const SCORING_METHOD_VERSION = "1.0";

export const SCORING_RULE = {
  // A level counts once its average evidence is at least "partly shown". Higher levels include lower ones, so
  // lower levels are not required to be shown separately.
  levelMin: 1.0,
  // A result is shown as a range when the next level is nearly reached, or this level only just reached.
  nextLevelNear: 0.75,
  justReached: 1.25,
  // An answer needs at least this many words to count as answered.
  minWords: 8,
  // At least this many answered items are needed for any result.
  minAnswered: 2,
} as const;

export type Shown = 0 | 1 | 2;
export type ItemJudgement = { shown: [Shown, Shown, Shown, Shown, Shown]; insufficient?: boolean };

export function wordCount(text: string | null | undefined): number {
  return (text ?? "").trim().split(/\s+/).filter(Boolean).length;
}

export function isAnswered(text: string | null | undefined): boolean {
  return wordCount(text) >= SCORING_RULE.minWords;
}

// Collapse whitespace, drop Arabic diacritics and tatweel, unify quotation marks, so a quote can be matched
// against the answer it came from.
export function normalizeForQuote(text: string): string {
  return text
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[“”«»"]/g, '"')
    .replace(/[‘’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Only evidence that can be found in the person's own answer counts.
export function quoteIsInAnswer(quote: string, answer: string): boolean {
  const q = normalizeForQuote(quote);
  return q.length > 0 && normalizeForQuote(answer).includes(q);
}

// Average the 0 to 2 judgements of the usable items, per level. Returns null with fewer than the minimum items.
export function averageEvidence(items: ItemJudgement[]): number[] | null {
  const usable = items.filter((i) => !i.insufficient);
  if (usable.length < SCORING_RULE.minAnswered) return null;
  return [0, 1, 2, 3, 4].map((l) => usable.reduce((sum, i) => sum + i.shown[l], 0) / usable.length);
}

// Average the evidence of several judgements of the same answers (method 1.0 judges each competency twice).
export function combineEvidence(runs: (number[] | null)[]): number[] | null {
  if (runs.length === 0 || runs.some((r) => r === null)) return null;
  const rs = runs as number[][];
  return [0, 1, 2, 3, 4].map((l) => rs.reduce((sum, r) => sum + r[l], 0) / rs.length);
}

export type CompetencyResult =
  | { status: "not_assessed"; reason: "too_few_answers" | "insufficient_evidence" | "no_level_reached" }
  | {
      status: "scored";
      level: ProficiencyLevel;
      rangeLow: ProficiencyLevel;
      rangeHigh: ProficiencyLevel;
      score: number;
      scoreLow: number;
      scoreHigh: number;
      evidence: number[];
    };

// Evidence vector -> level, range and score. Pure.
export function resultFromEvidence(m: number[] | null, reason: "too_few_answers" | "insufficient_evidence" = "insufficient_evidence"): CompetencyResult {
  if (!m) return { status: "not_assessed", reason };
  let level: ProficiencyLevel | null = null;
  for (const l of [...PROFICIENCY_LEVELS].reverse()) {
    if (m[l - 1] >= SCORING_RULE.levelMin) {
      level = l;
      break;
    }
  }
  if (level === null) return { status: "not_assessed", reason: "no_level_reached" };

  // Position inside the level's band: half the strength at the level, half the progress toward the next one.
  const strength = Math.min(1, Math.max(0, (m[level - 1] - SCORING_RULE.levelMin) / (2 - SCORING_RULE.levelMin)));
  const progress = level < 5 ? m[level] / 2 : strength;
  const f = level < 5 ? 0.5 * strength + 0.5 * progress : strength;
  const { min, max } = LEVEL_BANDS[level];
  const score = min + Math.round(f * (max - min));

  const rangeLow = (level > 1 && m[level - 1] < SCORING_RULE.justReached ? level - 1 : level) as ProficiencyLevel;
  const rangeHigh = (level < 5 && m[level] >= SCORING_RULE.nextLevelNear ? level + 1 : level) as ProficiencyLevel;
  // The score range runs from the top of the lower level to the bottom of the higher one when the result straddles
  // a boundary; otherwise it is the single score.
  const scoreLow = rangeLow < level ? Math.min(score, LEVEL_BANDS[rangeLow].max) : score;
  const scoreHigh = rangeHigh > level ? Math.max(score, LEVEL_BANDS[rangeHigh].min) : score;

  return { status: "scored", level, rangeLow, rangeHigh, score, scoreLow, scoreHigh, evidence: m };
}

// Gap between the level a role requires and what was demonstrated. A requirement inside the range is "close to
// meeting" it, not a gap; above the range the gap is "at least" the distance to the top of the range; below, none.
export type RangeGap = { kind: "none" | "close" | "gap"; atLeastLevels: number };

export function gapAgainstRange(requiredLevel: number | null | undefined, result: CompetencyResult): RangeGap | null {
  if (!requiredLevel || requiredLevel < 1 || result.status !== "scored") return null; // not required, or not assessed
  if (requiredLevel <= result.rangeLow) return { kind: "none", atLeastLevels: 0 };
  if (requiredLevel <= result.rangeHigh) return { kind: "close", atLeastLevels: 0 };
  return { kind: "gap", atLeastLevels: requiredLevel - result.rangeHigh };
}

export type Confidence = "low" | "medium" | "high";

// Confidence from how many items were answered, how consistent they are, and how much was written.
export function confidenceFor(input: { answered: number; total: number; perItemLevels: (number | null)[]; avgWords: number }): { label: Confidence; spread: number } {
  const levels = input.perItemLevels.filter((x): x is number => x !== null);
  const spread = levels.length ? Math.max(...levels) - Math.min(...levels) : 9;
  if (input.answered === input.total && spread <= 1 && input.avgWords >= 40) return { label: "high", spread };
  if (input.answered >= SCORING_RULE.minAnswered && spread <= 2) return { label: "medium", spread };
  return { label: "low", spread };
}

// ---------------------------------------------------------------------------------------------------------------
// Checking what the AI returned. Anything structurally wrong is an error (the caller retries once, then records
// "scoring failed" with no score). A quote that is not in the answer does not fail the competency: that judgement
// is simply counted as not shown.

export type RawJudgement = {
  item: number; // 1-based position among the items that were sent
  insufficient?: boolean;
  levels: { level: number; shown: number; quote?: string }[];
};

// A piece of evidence that was found in the person's own answer.
export type EvidenceQuote = { item: number; level: number; shown: 1 | 2; quote: string };

export type ValidatedJudgements =
  | { ok: true; items: ItemJudgement[]; quotes: EvidenceQuote[]; quotesChecked: number; quotesRejected: number }
  | { ok: false; error: string };

export function validateJudgements(raw: unknown, answers: string[]): ValidatedJudgements {
  if (!Array.isArray(raw) || raw.length !== answers.length) return { ok: false, error: "wrong number of items" };
  const items: ItemJudgement[] = [];
  const quotes: EvidenceQuote[] = [];
  let checked = 0;
  let rejected = 0;
  const seen = new Set<number>();
  for (const entry of raw as RawJudgement[]) {
    const pos = Number(entry?.item);
    if (!Number.isInteger(pos) || pos < 1 || pos > answers.length || seen.has(pos)) return { ok: false, error: "bad item number" };
    seen.add(pos);
    if (!Array.isArray(entry.levels) || entry.levels.length !== 5) return { ok: false, error: "expected five levels" };
    const shown: Shown[] = [];
    for (let l = 0; l < 5; l++) {
      const lv = entry.levels[l];
      if (lv?.level !== l + 1 || ![0, 1, 2].includes(lv.shown)) return { ok: false, error: "bad level entry" };
      let s = lv.shown as Shown;
      if (s > 0) {
        checked += 1;
        if (!quoteIsInAnswer(lv.quote ?? "", answers[pos - 1])) {
          rejected += 1;
          s = 0;
        } else {
          quotes.push({ item: pos, level: l + 1, shown: s as 1 | 2, quote: (lv.quote ?? "").trim() });
        }
      }
      shown.push(s);
    }
    items[pos - 1] = { shown: shown as ItemJudgement["shown"], insufficient: !!entry.insufficient };
  }
  return { ok: true, items, quotes, quotesChecked: checked, quotesRejected: rejected };
}
