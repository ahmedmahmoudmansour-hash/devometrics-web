export type SurveyQuestionType = "rating" | "multiple_choice" | "qualitative";

export type SurveyQuestion = {
  id: string;
  text: string;
  type: SurveyQuestionType;
  options?: string[];
};

export type SurveyAnswers = Record<string, number | string>;

export const SURVEY_THEMES = [
  "Culture",
  "Change Readiness",
  "Wellbeing & Workload",
  "Manager Effectiveness",
  "Psychological Safety",
  "Custom",
] as const;

export type SurveyTheme = (typeof SURVEY_THEMES)[number];

// Theme stays the stable English identifier stored on the survey row and
// passed to the AI prompt (previewSurveyQuestions) — only the displayed
// label is translated, at render time, same pattern as reviewStatusLabel.
const THEME_TRANSLATION_KEY: Record<SurveyTheme, string> = {
  Culture: "culture",
  "Change Readiness": "changeReadiness",
  "Wellbeing & Workload": "wellbeingWorkload",
  "Manager Effectiveness": "managerEffectiveness",
  "Psychological Safety": "psychologicalSafety",
  Custom: "custom",
};

export function surveyThemeLabel(t: (key: string) => string, theme: string): string {
  const key = THEME_TRANSLATION_KEY[theme as SurveyTheme];
  return key ? t(key) : theme;
}
