export type SeparationType = "voluntary" | "involuntary" | "other";

export type ExitInterviewQA = { question: string; answer: string };

export type ExitInterview = {
  id: string;
  organization_id: string;
  employee_user_id: string | null;
  employee_name: string;
  department: string | null;
  title: string | null;
  manager_name: string | null;
  last_day: string | null;
  separation_type: SeparationType;
  responses: ExitInterviewQA[];
  additional_notes: string | null;
  conducted_by: string;
  created_at: string;
};

// Structured root-cause output — grounded strictly in the interview text
// provided, same "decision support, not automated decision" posture as
// SuccessionReport.
export type ExitInterviewAnalysis = {
  topThemes: { theme: string; count: number; example: string }[];
  managerRelatedTurnover: string;
  departmentTrends: string;
  flightRiskIndicators: string[];
  summary: string;
};

export type ExitInterviewAnalysisRecord = {
  id: string;
  organization_id: string;
  analysis: ExitInterviewAnalysis;
  interview_count: number;
  created_at: string;
};
