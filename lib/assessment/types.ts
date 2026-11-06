// Shapes shared by the assessment server actions and the screens. No server-only code here.

import type { EvidenceQuote } from "@/lib/assessment/scoring";

export type AssessmentStatus = "assigned" | "in_progress" | "submitted" | "scored" | "scoring_failed";
export type ResultStatus = "scored" | "not_assessed" | "scoring_failed";
export type NotAssessedReason = "too_few_answers" | "insufficient_evidence" | "no_level_reached";

export type AssessmentSettings = {
  itemsPerCompetency: number;
  maxCompetencies: number;
  selfStartAllowed: boolean;
  retentionMonths: number;
  retakeIntervalDays: number;
};

export const DEFAULT_ASSESSMENT_SETTINGS: AssessmentSettings = {
  itemsPerCompetency: 3,
  maxCompetencies: 10,
  selfStartAllowed: false,
  retentionMonths: 12,
  retakeIntervalDays: 30,
};

export type RoleAssessmentRow = {
  id: string;
  employeeUserId: string;
  roleTitle: string;
  status: AssessmentStatus;
  route: "assigned" | "self";
  language: "en" | "ar";
  createdAt: string;
  submittedAt: string | null;
  scoredAt: string | null;
  competencyCount: number;
};

export type ItemView = {
  itemId: string;
  position: number;
  prompt: string;
  answer: string | null;
  purged: boolean;
};

export type ResultView = {
  id: string;
  status: ResultStatus;
  notAssessedReason: NotAssessedReason | null;
  level: number | null;
  rangeLow: number | null;
  rangeHigh: number | null;
  score: number | null;
  scoreLow: number | null;
  scoreHigh: number | null;
  confidence: "low" | "medium" | "high" | null;
  confidenceReasons: string[];
  evidenceQuotes: EvidenceQuote[];
  rationale: string | null;
  nextLevelGap: string | null;
  judgements: number;
  confirmedBy: string | null;
  confirmedAt: string | null;
  overrideLevel: number | null;
  overrideReason: string | null;
};

export type CompetencyEntry = {
  competencyKey: string;
  kind: "standard" | "company";
  versionId: string;
  name: string;
  description: string;
  levels: Record<string, string>;
  requiredTarget: number | null;
  requiredLevel: number | null;
  items: ItemView[];
  result: ResultView | null;
};

export type RoleAssessmentView = {
  id: string;
  employeeUserId: string;
  employeeName: string | null;
  roleTitle: string;
  roleLevel: string;
  status: AssessmentStatus;
  route: "assigned" | "self";
  language: "en" | "ar";
  createdAt: string;
  submittedAt: string | null;
  scoredAt: string | null;
  methodVersion: string;
  // How the viewer relates to this assessment.
  viewer: "employee" | "manager" | "admin";
  entries: CompetencyEntry[];
};

// roleTitle: null when the person has no role in Job Architecture yet (they cannot be assessed).
// availableOn: when the retake interval next allows an assessment (ISO date), or null if one can be assigned now.
export type AssignableEmployee = { userId: string; name: string; email: string; roleTitle: string | null; availableOn: string | null };
