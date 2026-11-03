// The wording of a competency as it is assessed: its name, description and the five level descriptions.
// Standard competencies take their wording from the translation files (starter wording, English or Arabic).
// Company competencies take theirs from the company's own library. Plain functions, no database or AI calls.

import enMessages from "@/messages/en.json";
import arMessages from "@/messages/ar.json";
import { COMPETENCY_DIMENSIONS, dimensionTranslationKey, type CompetencyDimension } from "@/lib/gap-analysis/dimensions";
import { PROFICIENCY_LEVELS } from "@/lib/proficiency/levels";
import { standardDescriptionKey, standardLevelKey, type CompetencyCategory } from "@/lib/proficiency/library";

export type AssessmentLanguage = "en" | "ar";
export type ItemStyle = "scenario" | "case" | "situational";

// Bump when the standard wording in the translation files changes, so snapshots can tell the versions apart.
export const STANDARD_WORDING_VERSION = "starter-1";

type Messages = { competencyLibrary: Record<string, string>; competencyDimensions: Record<string, string> };
const MESSAGES: Record<AssessmentLanguage, Messages> = {
  en: enMessages as unknown as Messages,
  ar: arMessages as unknown as Messages,
};

export type DefinitionText = {
  name: string;
  description: string;
  // Level descriptions keyed "1" to "5". A company may leave some blank.
  levels: Record<string, string>;
};

export function isStandardDimension(key: string): key is CompetencyDimension {
  return (COMPETENCY_DIMENSIONS as readonly string[]).includes(key);
}

export function isAssessmentLanguage(value: unknown): value is AssessmentLanguage {
  return value === "en" || value === "ar";
}

export function standardDefinitionText(dimension: CompetencyDimension, language: AssessmentLanguage): DefinitionText {
  const m = MESSAGES[language];
  const levels: Record<string, string> = {};
  for (const level of PROFICIENCY_LEVELS) levels[String(level)] = m.competencyLibrary[standardLevelKey(dimension, level)] ?? "";
  return {
    name: m.competencyDimensions[dimensionTranslationKey(dimension)] ?? dimension,
    description: m.competencyLibrary[standardDescriptionKey(dimension)] ?? "",
    levels,
  };
}

// How the questions for a competency are asked.
const STANDARD_STYLE: Record<CompetencyDimension, ItemStyle> = {
  "Technical Skills": "scenario",
  "AI & Digital Skills": "scenario",
  "Financial Literacy": "case",
  Communication: "situational",
  Leadership: "situational",
  "People Management": "situational",
  "Strategic Thinking": "case",
  "Critical Thinking": "case",
};

export function standardItemStyle(dimension: CompetencyDimension): ItemStyle {
  return STANDARD_STYLE[dimension];
}

export function companyItemStyle(category: CompetencyCategory | null | undefined): ItemStyle {
  if (category === "technical") return "scenario";
  if (category === "functional") return "case";
  return "situational";
}

// What the model is told about the style of question to write.
export const STYLE_BRIEF: Record<ItemStyle, string> = {
  scenario: "a realistic work scenario or problem to diagnose or decide, answered in writing",
  case: "a work case that needs planning, sequencing or a trade-off, answered in writing",
  situational: "a realistic situation asking what the person would do and why, with a written explanation",
};

// The level description a person needs to reach next, for "what is missing to reach the next level".
export function nextLevelText(levels: Record<string, string>, level: number): string | null {
  if (level >= 5) return null;
  const text = levels[String(level + 1)];
  return text && text.trim() ? text.trim() : null;
}
