// Choosing, showing and marking knowledge questions. Pure and deterministic: the same inputs always give the same output,
// so a check can be rebuilt and re-marked at any time from what was stored (question ids, a seed and the chosen answers).
import { AR_BANK } from "@/lib/jobBank/ar";
import { JOB_BANK } from "@/lib/jobBank";
import { QUESTION_LEVELS, questionId, type KnowledgeQuestion, type QuestionTranslation } from "./types";

export type KnowledgeLanguage = "en" | "ar";

// ------------------------------------------------------------------------------------------------ matching a company's
// competency to the bank: the job bank imports competencies by name, in either language.

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
let nameIndex: Map<string, string> | null = null;

export function bankKeyForName(name: string): string | null {
  if (!nameIndex) {
    nameIndex = new Map();
    for (const f of JOB_BANK) {
      const ar = AR_BANK[f.key];
      for (const c of f.competencies) {
        nameIndex.set(norm(c.name), c.key);
        const a = ar?.competencies[c.key]?.name;
        if (a) nameIndex.set(norm(a), c.key);
      }
    }
  }
  return nameIndex.get(norm(name)) ?? null;
}

// ------------------------------------------------------------------------------------------------ choosing questions

export type Requirement = { competencyKey: string; level: number };
export const DEFAULT_MAX_QUESTIONS = 40;

// For each required competency, ask the question at every level from 2 up to the level the role needs (at least the
// level-2 question). A role that needs level 4 gets three questions on that competency. When there would be more
// than `maxQuestions`, whole competencies are dropped starting with the lowest required level, never single questions,
// so every competency that is asked is asked properly.
export function selectQuestions(
  requirements: Requirement[],
  available: (id: string) => boolean,
  maxQuestions = DEFAULT_MAX_QUESTIONS
): { ids: string[]; chosen: { competencyKey: string; requiredLevel: number; count: number }[]; leftOut: string[] } {
  const seen = new Set<string>();
  const sorted = [...requirements]
    .filter((r) => r.level >= 1 && !seen.has(r.competencyKey) && (seen.add(r.competencyKey), true))
    .sort((a, b) => b.level - a.level || a.competencyKey.localeCompare(b.competencyKey));
  const ids: string[] = [];
  const chosen: { competencyKey: string; requiredLevel: number; count: number }[] = [];
  const leftOut: string[] = [];
  for (const r of sorted) {
    const top = Math.min(5, Math.max(2, Math.round(r.level)));
    const own = QUESTION_LEVELS.filter((l) => l <= top).map((l) => questionId(r.competencyKey, l)).filter(available);
    if (own.length === 0) continue;
    if (ids.length + own.length > maxQuestions) {
      leftOut.push(r.competencyKey);
      continue;
    }
    ids.push(...own);
    chosen.push({ competencyKey: r.competencyKey, requiredLevel: Math.round(r.level), count: own.length });
  }
  return { ids, chosen, leftOut };
}

// ------------------------------------------------------------------------------------------------ showing questions

function hashSeed(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The order the four options are shown in: displayed position -> original index. Fixed for a given seed and question.
export function optionOrder(seed: string, id: string): [number, number, number, number] {
  const order = [0, 1, 2, 3];
  const rand = random(hashSeed(`${seed}|${id}`));
  for (let i = 3; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order as [number, number, number, number];
}

export type PresentedQuestion = { id: string; competencyKey: string; stem: string; options: string[] };

// What a person sees: the wording with the options shuffled, and never the answer.
export function presentQuestion(id: string, text: QuestionTranslation, competencyKey: string, seed: string): PresentedQuestion {
  const order = optionOrder(seed, id);
  return { id, competencyKey, stem: text.stem, options: order.map((i) => text.options[i]) };
}

// A choice as shown (0 to 3) -> the option's original index, which is what is stored and marked.
export function originalIndex(seed: string, id: string, displayed: number): number | null {
  if (!Number.isInteger(displayed) || displayed < 0 || displayed > 3) return null;
  return optionOrder(seed, id)[displayed];
}

// ------------------------------------------------------------------------------------------------ marking

export type CompetencyResult = { competencyKey: string; requiredLevel: number; asked: number; correct: number };
export type CheckResult = { asked: number; answered: number; correct: number; percent: number; perCompetency: CompetencyResult[] };

// `answers` maps question id -> chosen ORIGINAL option index. A question left unanswered counts as wrong.
export function scoreCheck(
  ids: string[],
  answers: Record<string, number | null | undefined>,
  keyOf: (id: string) => { competencyKey: string; correct: number } | null,
  requiredLevels: Record<string, number>
): CheckResult {
  const per = new Map<string, CompetencyResult>();
  let answered = 0;
  let correct = 0;
  let asked = 0;
  for (const id of ids) {
    const k = keyOf(id);
    if (!k) continue; // a question that no longer exists is left out of the count rather than marked wrong
    asked++;
    const a = answers[id];
    const given = typeof a === "number";
    if (given) answered++;
    const right = given && a === k.correct;
    if (right) correct++;
    const row = per.get(k.competencyKey) ?? { competencyKey: k.competencyKey, requiredLevel: requiredLevels[k.competencyKey] ?? 0, asked: 0, correct: 0 };
    row.asked++;
    if (right) row.correct++;
    per.set(k.competencyKey, row);
  }
  return { asked, answered, correct, percent: asked === 0 ? 0 : Math.round((correct / asked) * 100), perCompetency: [...per.values()] };
}

// A plain reading of a percentage, for display. Indicative only: a handful of questions cannot establish a level.
export type Reading = "strong" | "adequate" | "gaps";
export function readPercent(percent: number): Reading {
  if (percent >= 80) return "strong";
  if (percent >= 60) return "adequate";
  return "gaps";
}

export type { KnowledgeQuestion };
