import type { KnowledgeQuestion, Options, QuestionLevel } from "./types";

// q(competency, level, stem, [four options], index of the correct option, why)
export function q(competencyKey: string, level: QuestionLevel, stem: string, options: Options, correct: 0 | 1 | 2 | 3, why: string): KnowledgeQuestion {
  return { competencyKey, level, stem, options, correct, why };
}
