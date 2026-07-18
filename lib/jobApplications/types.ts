export type JobApplicationStage =
  | "saved"
  | "applied"
  | "phone_screen"
  | "interview"
  | "offer"
  | "accepted"
  | "rejected"
  | "withdrawn";

export const JOB_APPLICATION_STAGES: { value: JobApplicationStage; label: string }[] = [
  { value: "saved", label: "Saved" },
  { value: "applied", label: "Applied" },
  { value: "phone_screen", label: "Phone screen" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];

// Stages that count as "still in motion" for the open-applications count —
// accepted/rejected/withdrawn are all end states, saved is pre-application.
export const ACTIVE_STAGES: JobApplicationStage[] = ["applied", "phone_screen", "interview", "offer"];

export function stageLabel(stage: JobApplicationStage): string {
  return JOB_APPLICATION_STAGES.find((s) => s.value === stage)?.label ?? stage;
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
