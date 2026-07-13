export type BigFiveProfile = {
  id: string;
  user_id: string;
  answers: Record<string, number>;
  scores: Record<import("../personality/bigFive").BigFiveTrait, number>;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  location: string | null;
  learning_preferences: string[];
  career_stage: string | null;
  accommodation: string | null;
  resource_tier: string | null;
  theme: string | null;
  is_admin: boolean;
  account_type: "individual" | "company";
  coach_voice: "off" | "sarah" | "theo" | "megan" | "jack";
  subscription_tier: "free" | "premium" | "enterprise";
  premium_trial_expires_at: string | null;
  student_verified_at: string | null;
  student_school_email: string | null;
  badges_enabled: boolean;
  // Added in migration 0057 — optional/defensive like the other
  // recently-added flags, may be absent until that migration has run.
  upgrade_prompt_dismissed?: boolean;
  // Added in migration 0059 — optional/defensive like the other recently-added
  // flags, may be absent until that migration has run.
  pending_data_deletion_at?: string | null;
  current_streak_days: number;
  longest_streak_days: number;
  last_active_date: string | null;
  job_history: import("@/lib/profile/extractCareerProfile").JobHistoryEntry[];
  skills: string[];
  qualifications: import("@/lib/profile/extractCareerProfile").QualificationEntry[];
  career_aspirations: string | null;
  created_at: string;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  employee_count: string | null;
  industry: string | null;
  logo_url: string | null;
  brand_color: string | null;
  created_by: string;
  created_at: string;
};

export type OrganizationCompetency = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  mapped_dimension: import("../gap-analysis/dimensions").CompetencyDimension | null;
  created_at: string;
};

export type OrganizationMember = {
  id: string;
  organization_id: string;
  user_id: string;
  role: "admin" | "member";
  title: string | null;
  department: string | null;
  country: string | null;
  // Added in migration 0049 — may be absent until it's run; readers use
  // isolated defensive queries rather than assuming these exist.
  manager_name?: string | null;
  manager_email?: string | null;
  business_unit?: string | null;
  location?: string | null;
  archived?: boolean;
  created_at: string;
};

export type OrganizationInvite = {
  id: string;
  organization_id: string;
  email: string;
  title: string | null;
  department: string | null;
  country: string | null;
  // Added in migrations 0049/0051 — may be absent until those have run;
  // readers use isolated defensive queries rather than assuming these exist.
  manager_name?: string | null;
  manager_email?: string | null;
  business_unit?: string | null;
  location?: string | null;
  invited_by: string;
  accepted_at: string | null;
  created_at: string;
};

export type CaseStudyResponse = {
  caseStudyId: string;
  type: "mcq" | "open";
  selectedOptionId?: string;
  optionScore?: number;
  openText?: string;
  aiScore?: number;
};

export type CaseStudyExerciseAttempt = {
  id: string;
  user_id: string;
  exercise_slug: string;
  response_text: string | null;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  report: import("../assessments/scoreCaseStudyExercise").ExerciseReport | null;
  created_at: string;
};

export type AssessmentResult = {
  id: string;
  user_id: string;
  assessment_slug: string;
  score: number;
  answers: number[];
  case_study_responses: CaseStudyResponse[];
  case_study_insight: string | null;
  completed_at: string;
};

export type GapAnalysis = {
  id: string;
  user_id: string;
  target_role: string;
  job_description: string;
  cv_text: string;
  performance_data: string | null;
  competencies: import("@/lib/gap-analysis/dimensions").CompetencyScore[];
  career_health_score: number;
  experience_summary: string | null;
  role_context_inferred: boolean;
  estimated_timeline_months: number | null;
  timeline_rationale: string | null;
  created_at: string;
};

export type ResumeAnalysis = {
  id: string;
  user_id: string;
  target_role: string | null;
  resume_text: string;
  ats_score: number;
  achievement_score: number;
  overall_score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  ats_issues: string[];
  weak_bullets: import("@/lib/resume/types").WeakBullet[];
  visibility_recommendations: string[];
  created_at: string;
};

export type DiscoveryProfile = {
  id: string;
  user_id: string;
  answers: import("@/lib/discovery/questions").DiscoveryAnswer[];
  summary: string;
  created_at: string;
};

export type CoachMessage = {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type CoachGrowMemory = {
  user_id: string;
  goal: string | null;
  reality: string | null;
  options: string | null;
  will: string | null;
  updated_at: string;
};

export type NoteInsight = {
  summary: string;
  actionItems: string[];
};

export type PersonalNote = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  ai_insight: NoteInsight | null;
  created_at: string;
  updated_at: string;
};

export type CareerPathNode = {
  role: string;
  readinessPercent: number;
  requiredSkills: string[];
  gaps: string[];
  estimatedTime: string;
  whyThisPath: string;
};

export type CareerPathBranch = {
  name: string;
  description: string;
  nodes: CareerPathNode[];
};

export type CareerPaths = {
  user_id: string;
  paths: {
    currentRole: string;
    branches: CareerPathBranch[];
  };
  generated_at: string;
};

export type DevelopmentPlan = {
  id: string;
  user_id: string;
  title: string;
  horizon: string | null;
  created_at: string;
};

export type Milestone = {
  id: string;
  plan_id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  position: number;
  completed: boolean;
  completed_at: string | null;
  weekly_hours: number | null;
  hours_period: string | null;
  budget_note: string | null;
  success_indicator: string | null;
  user_notes: string | null;
  assigned_by: string | null;
  created_at: string;
};

export type SuccessionCandidate = {
  userId: string;
  name: string;
  fitScore: number;
  readiness: string;
  strengths: string[];
  gaps: string[];
  developmentFocus: string;
  whyRanked: string;
  // True when an admin manually nominated this person (see
  // succession_nominations, migration 0061) — set deterministically in
  // code after the AI response comes back, never trusted from model output.
  nominated?: boolean;
};

export type SuccessionNomination = {
  id: string;
  role_id: string;
  employee_user_id: string;
  nominated_by: string;
  note: string;
  created_at: string;
};

export type SuccessionReport = {
  generatedAt: string;
  candidates: SuccessionCandidate[];
  riskNote: string;
  hasStrongSuccessor: boolean;
};

export type SuccessionRole = {
  id: string;
  organization_id: string;
  title: string;
  description: string;
  report: SuccessionReport | null;
  generated_at: string | null;
  created_by: string;
  created_at: string;
};

export type RoleplayMessage = {
  role: "user" | "assistant";
  content: string;
};

export type RoleplaySession = {
  id: string;
  user_id: string;
  scenario_slug: string;
  messages: RoleplayMessage[];
  feedback: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomScenario = {
  id: string;
  user_id: string;
  title: string;
  setup: string;
  your_role: string;
  opening_message: string;
  created_at: string;
};
