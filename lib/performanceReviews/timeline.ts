// Part 5(d) of the CEO's 2026-08-11 appraisal-simplification request: "we
// need to have timeline for appraisal and process." Deliberately
// informational only — never gates submission before opens_at or locks it
// after closes_at. This app's review posture elsewhere is permissive-by-
// default with RLS as the real boundary; a hard date gate with no
// admin-override path risks blocking a legitimate late submission (a
// manager on leave, a delayed hire, etc.). Computed client-side from
// already-fetched dates — no new schema, no server round-trip.
//
// Returns a translation key + numeric params rather than baked English
// text — same "stable key, translate at display" split used throughout
// this codebase (see lib/automations/catalog.ts) — so callers do
// `t(\`cycleTimeline.${result.key}\`, { days: result.days })`.

import type { ReviewStatus } from "./types";
import type { InstanceStep } from "./workflowTypes";

export type ReviewStageKey = "withYou" | "withManager" | "readyToClose" | "acknowledged" | "closed";

// 2026-08-18 process-delay audit: an employee's own view previously showed
// only the coarse ReviewStatus enum, with no sense of who currently needs
// to act. Pure function of already-fetched data (review status + this
// review's own step list) — no new schema, same "computed client-side"
// posture as describeCycleTimeline above. Department Head Review is
// deliberately NOT part of this sequence — it's an independent, optional
// track (see MyPerformanceReview's separate hasPendingDepartmentHeadReview
// signal) that never blocks or reorders the primary self/manager/close
// progression.
export function describeReviewStage(status: ReviewStatus, instanceSteps: InstanceStep[]): ReviewStageKey {
  if (status === "closed") return "closed";
  if (status === "acknowledged") return "acknowledged";
  if (status === "manager_submitted") return "readyToClose";
  if (status === "self_submitted") return "withManager";
  // not_started — most workflows start with the employee's own self-
  // assessment, but a configured workflow can omit that step entirely
  // (e.g. the probation_review starter goes straight to manager_assessment),
  // in which case the review is never actually "with you" at all.
  const hasSelfAssessmentStep = instanceSteps.length === 0 || instanceSteps.some((s) => s.step_type === "self_assessment");
  return hasSelfAssessmentStep ? "withYou" : "withManager";
}

export type TimelineTone = "neutral" | "warning" | "overdue";

export type CycleTimelineDescription = { key: "opensIn" | "closesIn" | "overdueBy"; days: number; tone: TimelineTone } | null;

function daysBetween(from: Date, to: Date): number {
  const a = new Date(from);
  a.setHours(0, 0, 0, 0);
  const b = new Date(to);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function describeCycleTimeline(opensAt: string | null, closesAt: string | null): CycleTimelineDescription {
  const now = new Date();

  if (opensAt) {
    const daysUntilOpen = daysBetween(now, new Date(opensAt));
    if (daysUntilOpen > 0) return { key: "opensIn", days: daysUntilOpen, tone: "neutral" };
  }

  if (closesAt) {
    const daysUntilClose = daysBetween(now, new Date(closesAt));
    if (daysUntilClose < 0) return { key: "overdueBy", days: Math.abs(daysUntilClose), tone: "overdue" };
    return { key: "closesIn", days: daysUntilClose, tone: daysUntilClose <= 7 ? "warning" : "neutral" };
  }

  return null;
}

export const TIMELINE_TONE_COLOR: Record<TimelineTone, string> = {
  neutral: "var(--text-muted)",
  warning: "var(--amber)",
  overdue: "#f87171",
};
