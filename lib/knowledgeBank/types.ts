// The knowledge question bank: right-or-wrong (single best answer) questions linked to the job bank's competencies.
// Plain data and plain functions: no database, no AI. Scoring is deterministic, so a check costs nothing to mark and the
// same answers always give the same result.
//
// STATUS OF THE CONTENT: drafted with AI and checked only by consistency tests. Not reviewed by subject experts, so an
// answer key may be wrong. It tests general professional knowledge, deliberately not the law or practice of one country.

import type { Level } from "@/lib/jobBank/types";

// The proficiency level a question is aimed at: a person working at that level or above should usually answer it
// correctly. Level 1 ("knows the terms exist") is not tested; every competency has one question for each of 2 to 5.
export type QuestionLevel = Exclude<Level, 1>;
export const QUESTION_LEVELS: QuestionLevel[] = [2, 3, 4, 5];

export type Options = [string, string, string, string];

export type KnowledgeQuestion = {
  // Job bank competency key, for example "hr.recruitment".
  competencyKey: string;
  level: QuestionLevel;
  stem: string;
  // Four options; `correct` is the index of the one best answer.
  options: Options;
  correct: 0 | 1 | 2 | 3;
  // One short sentence saying why the answer is right. Shown to the person after they submit, and to reviewers.
  why: string;
};

export type QuestionTranslation = { stem: string; options: Options; why: string };

export const questionId = (competencyKey: string, level: number) => `${competencyKey}#${level}`;
