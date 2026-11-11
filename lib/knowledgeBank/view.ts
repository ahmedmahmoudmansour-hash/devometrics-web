// Turning a stored knowledge check into what a screen shows. Pure, so it is tested without a database.
// A stored check is only: which questions, the shuffle seed, and what the person chose. Everything else (wording, order of
// options, the answer, the score) is rebuilt here from the question bank.
import { JOB_BANK } from "@/lib/jobBank";
import { AR_BANK } from "@/lib/jobBank/ar";
import { optionOrder, presentQuestion, readPercent, scoreCheck, type CheckResult, type PresentedQuestion, type Reading } from "./engine";
import { getQuestion, questionText } from "./index";
import { limitSeconds, readMeta, timingOf, type Timing } from "./timer";

export type CheckRow = {
  id: string;
  employee_user_id: string;
  role_title: string;
  language: "en" | "ar";
  bank_version: string;
  seed: string;
  question_ids: string[];
  required_levels: Record<string, number>;
  answers: Record<string, number> | null;
  created_at: string;
  submitted_at: string | null;
};

export function competencyName(key: string, language: "en" | "ar"): string {
  for (const f of JOB_BANK) {
    const c = f.competencies.find((x) => x.key === key);
    if (c) return (language === "ar" ? AR_BANK[f.key]?.competencies[key]?.name : null) ?? c.name;
  }
  return key;
}

const text = (id: string, language: "en" | "ar") => questionText(id, language) ?? questionText(id, "en");

export type TakeView = {
  id: string;
  roleTitle: string;
  language: "en" | "ar";
  questions: (PresentedQuestion & { competencyName: string })[];
  // What was saved so far, as the option position the person saw (0 to 3).
  draft: Record<string, number>;
  // The clock. startedAt is the server's start time (null if it could not be recorded); serverNow lets the page correct for a
  // wrong clock on the person's device. leftPage is how many times they have already left the page.
  timer: { startedAt: number | null; limitSeconds: number; serverNow: number; leftPage: number };
};

export function buildTakeView(row: CheckRow, now: number = Date.now()): TakeView {
  const questions: TakeView["questions"] = [];
  const draft: Record<string, number> = {};
  for (const id of row.question_ids) {
    const k = getQuestion(id);
    const t = text(id, row.language);
    if (!k || !t) continue;
    questions.push({ ...presentQuestion(id, t, k.competencyKey, row.seed), competencyName: competencyName(k.competencyKey, row.language) });
    const saved = row.answers?.[id];
    if (typeof saved === "number") {
      const shown = optionOrder(row.seed, id).indexOf(saved);
      if (shown >= 0) draft[id] = shown;
    }
  }
  const meta = readMeta(row.answers);
  return {
    id: row.id,
    roleTitle: row.role_title,
    language: row.language,
    questions,
    draft,
    timer: { startedAt: meta.startedAt ?? null, limitSeconds: limitSeconds(row.question_ids.length), serverNow: now, leftPage: meta.leftPage ?? 0 },
  };
}

export type ReviewQuestion = {
  id: string;
  competencyName: string;
  stem: string;
  options: string[]; // in the order the person saw them
  chosen: number | null;
  correct: number;
  why: string;
};

export type ResultView = {
  id: string;
  roleTitle: string;
  language: "en" | "ar";
  submittedAt: string;
  bankVersion: string;
  percent: number;
  reading: Reading;
  asked: number;
  answered: number;
  correct: number;
  perCompetency: (CheckResult["perCompetency"][number] & { competencyName: string })[];
  review: ReviewQuestion[];
  // Time used, times the page was left, late or not. Null for a check taken before the timer existed.
  timing: Timing | null;
};

const keyOf = (id: string) => {
  const k = getQuestion(id);
  return k ? { competencyKey: k.competencyKey, correct: k.correct } : null;
};

export function scoreRow(row: CheckRow): CheckResult {
  return scoreCheck(row.question_ids, row.answers ?? {}, keyOf, row.required_levels);
}

export function buildResultView(row: CheckRow): ResultView | null {
  if (!row.submitted_at) return null;
  const result = scoreRow(row);
  const review: ReviewQuestion[] = [];
  for (const id of row.question_ids) {
    const k = getQuestion(id);
    const t = text(id, row.language);
    if (!k || !t) continue;
    const order = optionOrder(row.seed, id);
    const saved = row.answers?.[id];
    review.push({
      id,
      competencyName: competencyName(k.competencyKey, row.language),
      stem: t.stem,
      options: order.map((i) => t.options[i]),
      chosen: typeof saved === "number" ? order.indexOf(saved) : null,
      correct: order.indexOf(k.correct),
      why: t.why,
    });
  }
  return {
    id: row.id,
    roleTitle: row.role_title,
    language: row.language,
    submittedAt: row.submitted_at,
    bankVersion: row.bank_version,
    percent: result.percent,
    reading: readPercent(result.percent),
    asked: result.asked,
    answered: result.answered,
    correct: result.correct,
    perCompetency: result.perCompetency.map((p) => ({ ...p, competencyName: competencyName(p.competencyKey, row.language) })),
    review,
    timing: timingOf(row.answers, row.question_ids.length, new Date(row.submitted_at).getTime()),
  };
}
