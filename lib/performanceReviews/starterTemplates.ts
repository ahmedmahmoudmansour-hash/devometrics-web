import type { StepType, StepData, CustomStepConfig } from "./workflowTypes";
import { defaultCompetencyRatingsConfig, defaultCustomStepConfig } from "./workflowTypes";

// A small catalog of prebuilt workflow starters, per the CEO's explicit
// request: rather than every org building a workflow from a blank template,
// offer starting points that demonstrate best practice without reducing
// flexibility — cloneStarterTemplate (workflowActions.ts) materializes one
// of these into a real, then-fully-editable org template. Static TypeScript,
// not database rows — adding or editing a starter later is a code change,
// not a migration, so this catalog can grow freely post-launch.

export type StarterKey =
  | "blank"
  | "devometrics_best_practice"
  | "annual_review"
  | "quarterly_checkin"
  | "probation_review"
  | "sales_performance_review"
  | "executive_review"
  | "leadership_review"
  | "startup_performance_cycle"
  | "manufacturing_performance_cycle";

export type StarterStepSeed = { stepType: StepType; title: string; description?: string; data?: StepData };

export type StarterTemplate = { key: StarterKey; labelKey: string; descriptionKey: string; steps: StarterStepSeed[] };

function core(stepType: Exclude<StepType, "custom">, title: string, description?: string, data?: StepData): StarterStepSeed {
  return { stepType, title, description, data };
}

function customStep(title: string, description: string, config: Partial<CustomStepConfig> & { custom_kind: string }): StarterStepSeed {
  return { stepType: "custom", title, description, data: { ...defaultCustomStepConfig(config.custom_kind), ...config } };
}

const STANDARD_FIVE: StarterStepSeed[] = [
  core("self_assessment", "Self-Reflection"),
  core("goals", "Focus Areas"),
  core("competency_ratings", "Competency Ratings", undefined, defaultCompetencyRatingsConfig()),
  core("manager_assessment", "Manager's Perspective"),
  core("conclusion", "Conclusion"),
];

export const STARTER_TEMPLATES: Record<StarterKey, StarterTemplate> = {
  blank: {
    key: "blank",
    labelKey: "blank",
    descriptionKey: "blankDescription",
    steps: [],
  },
  devometrics_best_practice: {
    key: "devometrics_best_practice",
    labelKey: "devometricsBestPractice",
    descriptionKey: "devometricsBestPracticeDescription",
    steps: STANDARD_FIVE,
  },
  annual_review: {
    key: "annual_review",
    labelKey: "annualReview",
    descriptionKey: "annualReviewDescription",
    steps: STANDARD_FIVE,
  },
  quarterly_checkin: {
    key: "quarterly_checkin",
    labelKey: "quarterlyCheckin",
    descriptionKey: "quarterlyCheckinDescription",
    steps: [
      core("self_assessment", "Quick Self-Check"),
      core("goals", "This Quarter's Focus"),
      core("manager_assessment", "Manager Check-in"),
    ],
  },
  probation_review: {
    key: "probation_review",
    labelKey: "probationReview",
    descriptionKey: "probationReviewDescription",
    steps: [
      core("manager_assessment", "Probation Assessment"),
      customStep("HR Review", "HR confirms the probation outcome.", {
        custom_kind: "hr_review",
        response_shape: "approval",
        assignment: { mode: "role", role: "org_admin" },
      }),
      core("conclusion", "Outcome"),
    ],
  },
  sales_performance_review: {
    key: "sales_performance_review",
    labelKey: "salesPerformanceReview",
    descriptionKey: "salesPerformanceReviewDescription",
    steps: [
      core("self_assessment", "Self-Reflection"),
      core("goals", "Quota & Pipeline Goals"),
      core("competency_ratings", "Sales Competencies", undefined, {
        fixed_dimensions: ["Communication", "Strategic Thinking", "Critical Thinking"],
        organization_competency_ids: [],
      }),
      core("manager_assessment", "Manager's Perspective"),
      core("conclusion", "Conclusion"),
    ],
  },
  executive_review: {
    key: "executive_review",
    labelKey: "executiveReview",
    descriptionKey: "executiveReviewDescription",
    steps: [
      core("self_assessment", "Self-Reflection"),
      core("goals", "Strategic Priorities"),
      core("competency_ratings", "Leadership Competencies", undefined, defaultCompetencyRatingsConfig()),
      core("manager_assessment", "Board / Manager Perspective"),
      customStep("Executive Approval", "A senior leader signs off on this review.", {
        custom_kind: "executive_approval",
        response_shape: "approval",
        assignment: { mode: "manual" },
      }),
      core("conclusion", "Conclusion"),
    ],
  },
  leadership_review: {
    key: "leadership_review",
    labelKey: "leadershipReview",
    descriptionKey: "leadershipReviewDescription",
    steps: [
      core("self_assessment", "Self-Reflection"),
      core("goals", "Focus Areas"),
      core("competency_ratings", "Leadership Competencies", undefined, {
        fixed_dimensions: ["Leadership", "People Management", "Strategic Thinking"],
        organization_competency_ids: [],
      }),
      customStep("360 Feedback", "Peers and reports share feedback, pooled anonymously.", {
        custom_kind: "360_feedback",
        response_shape: "text",
        multi_respondent: true,
        min_respondents: 3,
        assignment: { mode: "manual" },
        anonymize_to_employee: true,
      }),
      core("manager_assessment", "Manager's Perspective"),
      core("conclusion", "Conclusion"),
    ],
  },
  startup_performance_cycle: {
    key: "startup_performance_cycle",
    labelKey: "startupPerformanceCycle",
    descriptionKey: "startupPerformanceCycleDescription",
    steps: [
      core("self_assessment", "Self-Reflection"),
      core("goals", "This Cycle's Bets"),
      core("manager_assessment", "Manager's Perspective"),
      core("conclusion", "Conclusion"),
    ],
  },
  manufacturing_performance_cycle: {
    key: "manufacturing_performance_cycle",
    labelKey: "manufacturingPerformanceCycle",
    descriptionKey: "manufacturingPerformanceCycleDescription",
    steps: [
      core("self_assessment", "Self-Reflection"),
      core("goals", "Safety & Output Goals"),
      core("competency_ratings", "Competency Ratings", undefined, defaultCompetencyRatingsConfig()),
      core("manager_assessment", "Supervisor's Perspective"),
      customStep("Skip-Level Review", "The plant/site manager reviews before closing.", {
        custom_kind: "skip_level_review",
        response_shape: "approval",
        assignment: { mode: "role", role: "upline_manager_level_2" },
      }),
      core("conclusion", "Conclusion"),
    ],
  },
};

export const STARTER_KEYS = Object.keys(STARTER_TEMPLATES) as StarterKey[];
