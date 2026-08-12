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
