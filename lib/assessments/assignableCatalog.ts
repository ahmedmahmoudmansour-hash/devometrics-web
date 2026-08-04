import { ASSESSMENTS, resolveAssessmentName, resolveAssessmentDisplayName, type AssessmentTranslator } from "./catalog";
import { ENGLISH_PROFICIENCY_SLUG } from "./englishProficiency";
import { COGNITIVE_ABILITY_SLUG } from "./cognitiveAbility";
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

export type AssignableCatalogEntry = { slug: string; name: string; level: string };

// The full list of everything an admin can push to an employee via
// assigned_assessments — English Proficiency and Cognitive Reasoning live
// outside ASSESSMENTS (objective tests, not the self-report catalog) and
// Case Study Exercises are a fourth, separate catalog (timed, written,
// AI-scored) — all three folded in here so callers get one flat list
// instead of re-deriving it. Shared between the single-employee assign
// form (AssignAssessmentForm.tsx) and the bulk-assign table toolbar.
export function buildAssignableCatalog(t: AssessmentTranslator, tExercise: (key: string) => string): AssignableCatalogEntry[] {
  return [
    ...ASSESSMENTS.map((a) => ({ slug: a.slug, name: resolveAssignableDisplayName(t, tExercise, a.slug), level: a.level as string })),
    { slug: ENGLISH_PROFICIENCY_SLUG, name: resolveAssignableDisplayName(t, tExercise, ENGLISH_PROFICIENCY_SLUG), level: "A1–C2" },
    { slug: COGNITIVE_ABILITY_SLUG, name: resolveAssignableDisplayName(t, tExercise, COGNITIVE_ABILITY_SLUG), level: "Numerical/Verbal/Logical" },
    ...CASE_STUDY_EXERCISES.map((e) => ({
      slug: e.slug,
      name: resolveAssignableDisplayName(t, tExercise, e.slug),
      level: `${e.level} exercise`,
    })),
  ];
}
