export type FlightRiskConfidence = "high" | "medium" | "low";

// Every field here is either present with a real value, or null/absent
// meaning "no data" — never a guessed default. This is the whole record
// of what the model actually saw, shown alongside the score for
// transparency (see FlightRiskScore.signals_used).
export type FlightRiskSignals = {
  tenureDays: number;
  department: string | null;
  highPotential: boolean;
  successionNominee: boolean;
  currentPerformanceRating: number | null;
  activePlanCount: number;
  milestoneCompletionRate: number | null; // 0-1, null if no milestones exist yet
  surveyParticipationRate: number | null; // 0-1, null if none assigned
  managerNotesCount: number;
  departmentExitCount: number;
  managerExitCount: number;
};

export type FlightRiskScore = {
  id: string;
  organization_id: string;
  employee_user_id: string;
  score: number;
  confidence: FlightRiskConfidence;
  contributing_factors: string[];
  suggested_actions: string[];
  signals_used: FlightRiskSignals;
  created_at: string;
};
