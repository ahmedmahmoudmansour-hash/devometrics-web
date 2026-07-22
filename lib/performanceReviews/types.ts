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
};

export type ReviewStatus = "not_started" | "self_submitted" | "manager_submitted" | "acknowledged" | "closed";

export function reviewStatusLabel(status: ReviewStatus): string {
  switch (status) {
    case "not_started":
      return "Not started";
    case "self_submitted":
      return "Reflection submitted";
    case "manager_submitted":
      return "Manager's Perspective shared";
    case "acknowledged":
      return "Confirmed";
    case "closed":
      return "Closed";
  }
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
};

export type SelfAssessment = {
  review_id: string;
  rating: number | null;
  reflection: string | null;
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
export const COMPETENCY_RATING_LABELS: Record<number, string> = {
  1: "Needs Development",
  2: "Developing",
  3: "Meets Expectations",
  4: "Exceeds Expectations",
  5: "Outstanding",
};

export type CompetencyRating = {
  review_id: string;
  dimension: string;
  rating: number;
  note: string | null;
};

export type ReviewListItem = PerformanceReview & {
  employeeName: string;
  employeeEmail: string;
  selfRating: number | null;
  managerRating: number | null;
  // Only set on the manager's "My Team" list, which spans whichever cycle
  // each direct report's most recent review happens to be in — the admin's
  // per-cycle roster doesn't need this since every row is already the same
  // cycle by construction.
  cycleName?: string;
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
