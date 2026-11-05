// Consistency rules for the question bank, used by the tests so a careless edit cannot ship a broken question.
import type { BankFamily } from "@/lib/jobBank/types";
import { QUESTION_LEVELS, questionId, type KnowledgeQuestion, type QuestionTranslation } from "./types";

const MAX_STEM = 420;
const MAX_OPTION = 220;
const MAX_WHY = 320;
const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

export function validateQuestions(questions: KnowledgeQuestion[], jobBank: BankFamily[]): string[] {
  const problems: string[] = [];
  const competencyKeys = new Set(jobBank.flatMap((f) => f.competencies.map((c) => c.key)));
  const seen = new Set<string>();

  for (const k of questions) {
    const id = questionId(k.competencyKey, k.level);
    if (!competencyKeys.has(k.competencyKey)) problems.push(`${id}: unknown competency`);
    if (seen.has(id)) problems.push(`${id}: duplicate (one question per competency and level)`);
    seen.add(id);
    if (!QUESTION_LEVELS.includes(k.level)) problems.push(`${id}: level must be 2 to 5`);
    if (!k.stem.trim() || k.stem.length > MAX_STEM) problems.push(`${id}: stem length`);
    if (!/[?.]$/.test(k.stem.trim())) problems.push(`${id}: stem should end with a question mark or full stop`);
    if (k.options.length !== 4) problems.push(`${id}: needs exactly four options`);
    const set = new Set(k.options.map(norm));
    if (set.size !== 4) problems.push(`${id}: options must be four different texts`);
    k.options.forEach((o, i) => {
      if (!o.trim() || o.length > MAX_OPTION) problems.push(`${id}: option ${i + 1} length`);
    });
    if (![0, 1, 2, 3].includes(k.correct)) problems.push(`${id}: correct must be 0 to 3`);
    if (!k.why.trim() || k.why.length > MAX_WHY) problems.push(`${id}: explanation length`);
    // Options that give the answer away by their form.
    if (k.options.some((o) => /\b(all of the above|none of the above)\b/i.test(o))) problems.push(`${id}: no "all/none of the above"`);
  }
  return problems;
}

// Every competency in the job bank has exactly one question at each level 2 to 5.
export function missingQuestions(questions: KnowledgeQuestion[], jobBank: BankFamily[]): string[] {
  const have = new Set(questions.map((k) => questionId(k.competencyKey, k.level)));
  const missing: string[] = [];
  for (const f of jobBank) for (const c of f.competencies) for (const l of QUESTION_LEVELS) if (!have.has(questionId(c.key, l))) missing.push(questionId(c.key, l));
  return missing;
}

// Test-wise people guess by length: "the longest option is right" or "the shortest is". For each question, how long is the
// correct option compared with the three wrong ones? Returns the share of questions in which it is the shortest,
// second shortest, second longest and longest. Pure chance would be 25% each.
export function lengthRankShares(questions: KnowledgeQuestion[]): [number, number, number, number] {
  const c = [0, 0, 0, 0];
  for (const k of questions) {
    const lens = k.options.map((o) => o.length);
    const own = lens[k.correct];
    c[lens.filter((l) => l < own).length]++;
  }
  const n = questions.length || 1;
  return c.map((x) => x / n) as [number, number, number, number];
}

// How evenly the correct answer is spread over the four positions as written (it is shuffled again when shown).
export function positionShares(questions: KnowledgeQuestion[]): number[] {
  const c = [0, 0, 0, 0];
  for (const k of questions) c[k.correct]++;
  return c.map((n) => (questions.length ? n / questions.length : 0));
}

export function validateTranslations(questions: KnowledgeQuestion[], translations: Record<string, QuestionTranslation>): string[] {
  const problems: string[] = [];
  const ids = new Set(questions.map((k) => questionId(k.competencyKey, k.level)));
  for (const id of ids) if (!translations[id]) problems.push(`${id}: missing Arabic`);
  for (const [id, t] of Object.entries(translations)) {
    if (!ids.has(id)) problems.push(`${id}: Arabic for a question that does not exist`);
    if (!t.stem.trim() || t.stem.length > MAX_STEM) problems.push(`${id}: Arabic stem length`);
    if (new Set(t.options.map(norm)).size !== 4) problems.push(`${id}: Arabic options must be four different texts`);
    t.options.forEach((o, i) => {
      if (!o.trim() || o.length > MAX_OPTION) problems.push(`${id}: Arabic option ${i + 1} length`);
    });
    if (!t.why.trim() || t.why.length > MAX_WHY) problems.push(`${id}: Arabic explanation length`);
  }
  return problems;
}
