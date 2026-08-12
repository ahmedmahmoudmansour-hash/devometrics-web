import type { InstanceStep } from "./workflowTypes";

export type ReviewCycleStatus = "draft" | "open" | "closed";

export type PerformanceReviewCycle = {
  id: string;
  organization_id: string;
  name: string;
  status: ReviewCycleStatus;
  created_by: string;
  opens_at: string | null;
  closes_at: string | null;
  created_at: string;
  workflow_template_id: string | null;
};

export type ReviewStatus = "not_started" | "self_submitted" | "manager_submitted" | "acknowledged" | "closed";

// Labels are translated — callers pass their own `useTranslations("performanceReviewLabels")`
// result so this plain (non-component) module can stay translation-library-agnostic.
type Translator = (key: string) => string;

export function reviewStatusLabel(t: Translator, status: ReviewStatus): string {
  return t(`reviewStatus.${status}`);
}

export type PerformanceReview = {
  id: string;
  cycle_id: string;
  organization_id: string;
  employee_user_id: string;
  status: ReviewStatus;
  employee_acknowledged_at: string | null;
  employee_acknowledgment_comment: string | null;
  conclusion: string | null;
  manager_closed_at: string | null;
  manager_closed_by: string | null;
  created_at: string;
  // Probation acceptance gate (migration 0122) — set true only by
  // create_automated_review_cycle for the probation_review starter. While
  // true and hiring_manager_accepted_at is null, the review is hidden from
  // the employee entirely (see getMyCurrentReview) so a new hire never sees
  // a probation review exists until their hiring manager accepts it.
  requires_hiring_manager_acceptance: boolean;
  hiring_manager_accepted_at: string | null;
  hiring_manager_accepted_by: string | null;
};

export type SelfAssessment = {
  review_id: string;
  rating: number | null;
  reflection: string | null;
  key_strengths: string | null;
  recommendations: string | null;
  development_areas: string | null;
  submitted_at: string | null;
  updated_at: string;
};

export type ManagerAssessment = {
  review_id: string;
  reviewer_user_id: string | null;
  rating: number | null;
  feedback: string | null;
  development_needs: string | null;
  submitted_at: string | null;
  updated_at: string;
};

export type GoalStatus = "not_started" | "in_progress" | "achieved" | "missed";

export type ReviewGoal = {
  id: string;
  review_id: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  target: string | null;
  actual: string | null;
  created_at: string;
};

// 1-5 with clear labels, not a bare number — matches standard practice
// (SHRM/industry review templates consistently use a labeled scale).
export function competencyRatingLabel(t: Translator, rating: number): string {
  return t(`competencyRating.${rating}`);
}

export function goalStatusLabel(t: Translator, status: GoalStatus): string {
  return t(`goalStatus.${status}`);
}

export type CompetencyRating = {
  review_id: string;
  dimension: string | null;
  rating: number;
  note: string | null;
  organization_competency_id: string | null;
};

export type ReviewListItem = PerformanceReview & {
  employeeName: string;
  employeeEmail: string;
  selfRating: number | null;
  selfReflection: string | null;
  selfKeyStrengths: string | null;
  selfRecommendations: string | null;
  selfDevelopmentAreas: string | null;
  managerRating: number | null;
  // Only set on the manager's "My Team" list, which spans whichever cycle
  // each direct report's most recent review happens to be in — the admin's
  // per-cycle roster doesn't need this since every row is already the same
  // cycle by construction.
  cycleName?: string;
  // This review's configured step list (migration 0103), in position order
  // — drives which section editors ImpactCycleReviewRow renders and in what
  // order, instead of a hardcoded fixed sequence. Empty on a database that
  // hasn't run migration 0103 yet.
  instanceSteps: InstanceStep[];
};

export type ReviewDetail = {
  review: PerformanceReview;
  cycle: PerformanceReviewCycle;
  self: SelfAssessment | null;
  manager: ManagerAssessment | null;
  goals: ReviewGoal[];
  pastGoals: ReviewGoal[];
  competencyRatings: CompetencyRating[];
  employeeName: string;
  employeeEmail: string;
  // Read-only from the employee's side — only ever populated with signed-off
  // rows, since a not-yet-signed skip-level entry isn't "his relevant part"
  // yet.
  uplineSignoffs: UplineSignoff[];
  instanceSteps: InstanceStep[];
};

// One link in the Org Chart's manager_user_id chain above an employee —
// level 1 is their direct manager, level 2 their manager's manager, etc.
export type UplineChainEntry = {
  level: number;
  managerUserId: string;
  managerName: string;
};

export type UplineSignoff = {
  review_id: string;
  manager_user_id: string;
  level: number;
  comment: string | null;
  signed_off_at: string | null;
  managerName?: string;
};

// The employee's role-required target level (from Job Architecture, if
// they have a current_role_id set) and their most recently measured level
// (from their latest Gap Analysis) for one competency dimension — shown as
// reference alongside the manager's own rating, not a substitute for it.
export type AppraisalCompetencyContext = {
  dimension: string;
  roleTarget: number | null;
  measuredCurrent: number | null;
};
