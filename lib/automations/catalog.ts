// The fixed catalog of pre-built automation recipes — deliberately not a
// generic workflow builder (arbitrary trigger -> action chains, admin-
// defined). An admin can only turn these specific, curated recipes on or
// off; adding a new recipe is a code change, not something an org
// configures itself. Title/description are the stable English identifiers
// shown on the toggle UI (translated at the UI layer via
// t(`workflowAutomation.recipes.${key}...`), same "stable key, translate
// at display" split used throughout this codebase.
export type RecipeKey = "hire_to_onboarding" | "low_score_to_reassessment" | "high_potential_to_succession";

export const RECIPES: { key: RecipeKey; title: string; description: string }[] = [
  {
    key: "hire_to_onboarding",
    title: "New hire welcome",
    description: "When a hired candidate joins, automatically assign them any Knowledge Hub content flagged for new hires and email their manager to schedule a 30-day check-in.",
  },
  {
    key: "low_score_to_reassessment",
    title: "Low assessment score follow-up",
    description: "When someone scores below 50 on an assessment, add a task to review the results now and a reminder to retake it in 60 days.",
  },
  {
    key: "high_potential_to_succession",
    title: "High-potential flag to manager",
    description: "When someone's Gap Analysis places them in the High Potential zone, email their manager to consider them for succession planning.",
  },
];
