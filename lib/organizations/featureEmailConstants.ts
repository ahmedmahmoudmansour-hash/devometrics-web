// Plain constants/types shared by lib/organizations/featureEmails.ts (a
// "use server" file, which can only export async functions) and any client
// component that needs them. Keep this file free of "use server" and free
// of anything that isn't a plain value or type.

export const FEATURE_EMAIL_KEYS = [
  "knowledge_hub",
  "performance_review",
  "survey",
  "assessment",
  "job_architecture",
  "hiring",
  "org_chart",
  "competency_management",
  "high_potential",
  "succession",
  "scorecard",
  "exit_interviews",
  "onboarding",
] as const;
export type FeatureEmailKey = (typeof FEATURE_EMAIL_KEYS)[number];

export type FeatureEmailRow = {
  id: string;
  subject: string;
  message: string;
  recipientCount: number;
  sendAt: string;
  sentAt: string | null;
  sentCount: number | null;
  failedCount: number | null;
  createdAt: string;
};
