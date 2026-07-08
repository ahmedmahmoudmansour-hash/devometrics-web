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
