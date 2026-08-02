export type JobApplicationStage =
  | "saved"
  | "applied"
  | "phone_screen"
  | "interview"
  | "offer"
  | "accepted"
  | "rejected"
  | "withdrawn";

export const JOB_APPLICATION_STAGES: JobApplicationStage[] = [
  "saved",
  "applied",
  "phone_screen",
  "interview",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
];

// Stages that count as "still in motion" for the open-applications count —
// accepted/rejected/withdrawn are all end states, saved is pre-application.
export const ACTIVE_STAGES: JobApplicationStage[] = ["applied", "phone_screen", "interview", "offer"];

const STAGE_TRANSLATION_KEY: Record<JobApplicationStage, string> = {
  saved: "saved",
  applied: "applied",
  phone_screen: "phoneScreen",
  interview: "interview",
  offer: "offer",
  accepted: "accepted",
  rejected: "rejected",
  withdrawn: "withdrawn",
};

// t must come from useTranslations("jobApplicationStages").
export function stageLabel(t: (key: string) => string, stage: JobApplicationStage): string {
  return t(STAGE_TRANSLATION_KEY[stage]);
}

export type JobApplication = {
  id: string;
  user_id: string;
  company: string;
  role_title: string;
  job_url: string | null;
  location: string | null;
  source: string | null;
  stage: JobApplicationStage;
  applied_date: string | null;
  next_action: string | null;
  next_action_date: string | null;
  salary_range: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
