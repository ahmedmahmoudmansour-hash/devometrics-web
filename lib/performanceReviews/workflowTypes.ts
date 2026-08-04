// Neutral naming deliberately (WorkflowTemplate, not
// PerformanceReviewWorkflowTemplate) — the SQL tables keep the
// performance_review_ prefix (no v1 benefit to renaming those), but this
// step-engine shape could eventually serve onboarding, succession, or
// promotion requests too, so nothing here name-locks it to reviews.

export const CORE_STEP_TYPES = ["self_assessment", "goals", "competency_ratings", "manager_assessment", "conclusion"] as const;
export type CoreStepType = (typeof CORE_STEP_TYPES)[number];
export type StepType = CoreStepType | "custom";

// NOTE ON KEY CASING: these field names are stored verbatim in jsonb columns
// that migration 0103's RPCs and RLS policies also read directly (e.g.
// `data->>'response_shape'`, `data->'assignment'->>'mode'`). jsonb has no
// schema, so the TypeScript field names below MUST match the SQL side
// byte-for-byte — snake_case throughout, not the camelCase this codebase
// otherwise prefers, specifically to avoid a silent key-mismatch bug (this
// was caught once already while building this feature: an earlier camelCase
// draft of this type would have made every custom-step RPC read undefined).

export type CompetencyRatingsStepConfig = {
  // Empty array is the "all 8 fixed platform dimensions" sentinel — keeps
  // the migrated default identical to today's only behavior. Not read by
  // SQL (competency_ratings has no RPC-side jsonb dependency), but kept
  // snake_case for consistency with the rest of this file.
  fixed_dimensions: string[];
  organization_competency_ids: string[];
};

export type CustomStepResponseShape = "approval" | "rating" | "text";
export type CustomStepAssignmentMode = "role" | "manual";
export type CustomStepRole = "direct_manager" | "org_admin" | `upline_manager_level_${number}`;

export type CustomStepConfig = {
  // Free label — the CEO's own examples are suggestions, not a DB enum
  // ("or freely typed beyond that list").
  custom_kind: string;
  response_shape: CustomStepResponseShape;
  multi_respondent: boolean;
  min_respondents: number | null;
  max_respondents: number | null;
  assignment: { mode: CustomStepAssignmentMode; role?: CustomStepRole | null };
  // Only meaningful for custom_kind in ("peer_feedback", "360_feedback") —
  // enforced at the RLS layer, this flag just drives the UI/aggregate path.
  anonymize_to_employee: boolean;
  ai_assist_enabled: boolean;
};

// Reserved for a future conditional-step engine (never read in v1) — see
// migration 0103's header comment. Always null today.
export type VisibilityCondition = { field: string; operator: string; value: unknown } | null;

export type StepData = Partial<CompetencyRatingsStepConfig> & Partial<CustomStepConfig> & { visibilityCondition?: VisibilityCondition };

export type WorkflowTemplate = {
  id: string;
  organization_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
};

export type WorkflowStep = {
  id: string;
  template_id: string;
  position: number;
  step_type: StepType;
  title: string;
  description: string | null;
  data: StepData;
  created_at: string;
};

export type InstanceStep = {
  id: string;
  review_id: string;
  workflow_step_id: string | null;
  position: number;
  step_type: StepType;
  title: string;
  description: string | null;
  data: StepData;
  submitted_at: string | null;
  created_at: string;
};

export type CustomStepAssignment = {
  id: string;
  instance_step_id: string;
  review_id: string;
  assignee_user_id: string;
  assigned_by: string | null;
  assigned_at: string;
  assigneeName?: string;
};

export type CustomStepResponse = {
  id: string;
  instance_step_id: string;
  review_id: string;
  responder_user_id: string;
  response: Record<string, unknown>;
  submitted_at: string | null;
};

export type CustomStepCompletion = {
  assigned_count: number;
  submitted_count: number;
  min_required: number | null;
};

export type CustomStepAggregate = {
  ready: boolean;
  submitted_count: number;
  threshold: number;
  response_shape: CustomStepResponseShape;
  avg_rating: number | null;
  approve_count: number | null;
  reject_count: number | null;
  comments: string[] | null;
};

const STEP_TYPE_TRANSLATION_KEY: Record<StepType, string> = {
  self_assessment: "selfAssessment",
  goals: "goals",
  competency_ratings: "competencyRatings",
  manager_assessment: "managerAssessment",
  conclusion: "conclusion",
  custom: "custom",
};

type Translator = (key: string) => string;

export function stepTypeLabel(t: Translator, type: StepType): string {
  return t(`stepType.${STEP_TYPE_TRANSLATION_KEY[type]}`);
}

export function defaultCompetencyRatingsConfig(): CompetencyRatingsStepConfig {
  return { fixed_dimensions: [], organization_competency_ids: [] };
}

export function defaultCustomStepConfig(customKind = ""): CustomStepConfig {
  return {
    custom_kind: customKind,
    response_shape: "text",
    multi_respondent: false,
    min_respondents: null,
    max_respondents: null,
    assignment: { mode: "manual" },
    anonymize_to_employee: customKind === "peer_feedback" || customKind === "360_feedback",
    ai_assist_enabled: true,
  };
}
