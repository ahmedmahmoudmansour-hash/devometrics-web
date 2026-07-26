import type { CompetencyScore } from "@/lib/gap-analysis/dimensions";

export type JobPostingStatus = "draft" | "open" | "closed";
export type HiringStage = "applied" | "phone_screen" | "interview" | "offer" | "hired" | "rejected";

export const HIRING_STAGES: HiringStage[] = ["applied", "phone_screen", "interview", "offer", "hired", "rejected"];

export type JobPosting = {
  id: string;
  organization_id: string;
  title: string;
  department: string;
  status: JobPostingStatus;
  job_description: string;
  responsibilities: string;
  linked_role_id: string | null;
  ranking_report: CandidateRankingReport | null;
  ranking_generated_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type JobPostingCompetencyRequirement = {
  id: string;
  organization_id: string;
  posting_id: string;
  dimension: string;
  target_level: number;
};

export type HiringCandidate = {
  id: string;
  organization_id: string;
  posting_id: string;
  full_name: string;
  email: string;
  phone: string;
  stage: HiringStage;
  cv_storage_path: string | null;
  cv_file_name: string | null;
  cv_file_size_bytes: number | null;
  cv_mime_type: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type HiringCandidateCvScore = {
  id: string;
  organization_id: string;
  candidate_id: string;
  posting_id: string;
  target_role: string;
  job_description: string;
  cv_text: string;
  competencies: CompetencyScore[];
  career_health_score: number;
  scored_by: string | null;
  created_at: string;
  updated_at: string;
};

export type HiringCandidateInterviewNote = {
  id: string;
  organization_id: string;
  candidate_id: string;
  author_id: string;
  note: string;
  created_at: string;
};

export type CandidateAssessment = {
  overallScore: number;
  strengths: string[];
  concerns: string[];
  recommendation: string;
};

export type HiringCandidateAssessment = {
  id: string;
  organization_id: string;
  candidate_id: string;
  assessment: CandidateAssessment;
  based_on_note_count: number;
  generated_by: string | null;
  generated_at: string;
};

export type RankedCandidate = {
  candidateId: string;
  name: string;
  fitScore: number;
  strengths: string[];
  concerns: string[];
  recommendation: string;
  whyRanked: string;
};

export type CandidateRankingReport = {
  generatedAt: string;
  candidates: RankedCandidate[];
  riskNote: string;
  hasStrongCandidate: boolean;
};
