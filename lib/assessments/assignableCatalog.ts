import { resolveAssessmentName, resolveAssessmentDisplayName, type AssessmentTranslator } from "./catalog";
import { CASE_STUDY_EXERCISES, localizeCaseStudyExercise } from "./caseStudyExercises";

// Everything an admin can push to an employee via assigned_assessments
// spans three separate catalogs — the Likert ASSESSMENTS, the two
// objective tests (English/Cognitive, handled inside catalog.ts's own
// resolvers), and Case Study Exercises (a fourth, separate file). Kept
// here rather than folded into catalog.ts to avoid a circular import
// (caseStudyExercises.ts already imports a type from catalog.ts).

export type AssignableKind = "assessment" | "exercise";

export function getAssignableKind(slug: string): AssignableKind {
  return CASE_STUDY_EXERCISES.some((e) => e.slug === slug) ? "exercise" : "assessment";
}

// Stable English identifier — must stay untranslated, same contract as
// resolveAssessmentName (AI-context and admin-report callers read this).
export function resolveAssignableName(slug: string): string {
  const exercise = CASE_STUDY_EXERCISES.find((e) => e.slug === slug);
  return exercise ? exercise.title : resolveAssessmentName(slug);
}

// Translated sibling for direct UI rendering. exerciseT must come from
// useTranslations("caseStudyExercises") / getTranslations("caseStudyExercises").
export function resolveAssignableDisplayName(
  t: AssessmentTranslator,
  exerciseT: (key: string) => string,
  slug: string
): string {
  const exercise = CASE_STUDY_EXERCISES.find((e) => e.slug === slug);
  return exercise ? localizeCaseStudyExercise(exercise, exerciseT).title : resolveAssessmentDisplayName(t, slug);
}
