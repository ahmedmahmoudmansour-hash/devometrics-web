// Arabic wording for the job bank. Kept apart from the English data and keyed by the same stable keys, so the structure
// (which role needs which competency at which level) is defined once and only the words are translated.
//
// STATUS: drafted with AI in Modern Standard Arabic and checked only for completeness and form by tests. Not reviewed by a
// native-speaking HR professional. Treat it as a starting point to adapt, exactly like the English content.
import type { LevelTexts } from "../types";

export type CompetencyTranslation = { name: string; description: string; levels: LevelTexts };
export type RoleTranslation = { title: string; responsibilities: string };
export type FamilyTranslation = {
  name: string;
  description: string;
  competencies: Record<string, CompetencyTranslation>;
  roles: Record<string, RoleTranslation>;
};
