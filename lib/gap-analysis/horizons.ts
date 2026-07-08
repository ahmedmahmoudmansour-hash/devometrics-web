import type { LearningFormat } from "./actionLibrary";
import type { ResourceTier } from "./freeResources";

export const HORIZONS = ["30-day", "90-day", "12-month", "18-month", "24-month", "3-year"] as const;
export type Horizon = (typeof HORIZONS)[number];

export type HoursPeriod = "week" | "month" | "quarter";

// How many of the ranked gaps a plan pulls in, and the checkpoint cadence at
// that horizon. Longer horizons cover more ground but check in less often —
// nobody plans a 3-year journey week by week, and showing weekly checkpoints
// that far out was exactly the kind of overpromise-by-granularity we're
// trying to stop doing. Nothing is ever framed "per week" — a weekly-hours
// ask reads as more pressure than the same commitment shown monthly, even
// though it's the same number of hours. 30-day and 90-day both show
// monthly; 12-month and 3-year show quarterly.
//
// snapWeeks and hoursCadenceWeeks are deliberately separate numbers even
// though they're equal everywhere except 30-day: snapWeeks controls how
// finely milestone due-dates get staggered across the horizon's real span
// (30-day keeps weekly granularity — a month is only 4 weeks, so its
// milestones still land on different weeks), while hoursCadenceWeeks
// controls the checkpoint size used for the hours/budget display (30-day
// rolls its weekly-hours base rate up to a monthly figure instead of
// showing "hrs/week"). Collapsing them into one number would either break
// the due-date spread or bring back the "per week" framing.
const HORIZON_CONFIG: Record<
  Horizon,
  { gapCount: number; snapWeeks: number; hoursCadenceWeeks: number; cadenceLabel: HoursPeriod }
> = {
  "30-day": { gapCount: 2, snapWeeks: 1, hoursCadenceWeeks: 4, cadenceLabel: "month" },
  "90-day": { gapCount: 5, snapWeeks: 4, hoursCadenceWeeks: 4, cadenceLabel: "month" },
  "12-month": { gapCount: 7, snapWeeks: 13, hoursCadenceWeeks: 13, cadenceLabel: "quarter" },
  "18-month": { gapCount: 8, snapWeeks: 13, hoursCadenceWeeks: 13, cadenceLabel: "quarter" },
  "24-month": { gapCount: 8, snapWeeks: 13, hoursCadenceWeeks: 13, cadenceLabel: "quarter" },
  "3-year": { gapCount: 8, snapWeeks: 13, hoursCadenceWeeks: 13, cadenceLabel: "quarter" },
};

export function gapCountForHorizon(horizon: Horizon): number {
  return HORIZON_CONFIG[horizon].gapCount;
}

export function cadenceLabelForHorizon(horizon: Horizon): HoursPeriod {
  return HORIZON_CONFIG[horizon].cadenceLabel;
}

// Total calendar span each horizon actually covers, so milestone target
// dates are spread across the real declared span instead of clustering in
// the first few weeks — otherwise labeling something "3-year" is just a
// name, not a structural fact about the plan.
const TOTAL_WEEKS: Record<Horizon, number> = {
  "30-day": 4,
  "90-day": 13,
  "12-month": 52,
  "18-month": 78,
  "24-month": 104,
  "3-year": 156,
};

// Cumulative week offset for milestone `index` of `count` total, spread
// across the horizon's real span and snapped to that horizon's due-date
// granularity — separate from the hours/budget display cadence above.
export function targetWeekOffset(horizon: Horizon, index: number, count: number): number {
  const { snapWeeks } = HORIZON_CONFIG[horizon];
  const totalWeeks = TOTAL_WEEKS[horizon];
  const raw = ((index + 1) / count) * totalWeeks;
  const snapped = Math.round(raw / snapWeeks) * snapWeeks;
  return Math.max(snapWeeks, snapped);
}

const BASE_WEEKLY_HOURS: Record<LearningFormat, number> = {
  "Reading & self-study": 3,
  "Research & case studies": 3,
  "Video courses": 3,
  "Short courses & workshops": 4,
  "Professional certifications": 4,
  "Webinars & virtual events": 1,
  "Hands-on projects": 5,
  "Mentorship & coaching": 1,
  "Peer learning": 2,
  "Live cohort classes": 4,
};

// Hours per checkpoint period (month/quarter, never week) at this horizon.
// A 12-month plan showing "~3 hrs/week" for a year straight reads as a much
// bigger ask than "~40 hrs/quarter", even though it's the same commitment —
// the framing should match how someone would actually plan for it.
export function periodHours(format: LearningFormat, horizon: Horizon): number {
  const { hoursCadenceWeeks } = HORIZON_CONFIG[horizon];
  return Math.max(1, Math.round(BASE_WEEKLY_HOURS[format] * hoursCadenceWeeks));
}

// Rough market ranges, not a specific provider's real price — actual course
// pricing can't be verified from here, so these stay wide and labeled as
// estimates rather than presenting a false level of precision.
export function budgetNote(format: LearningFormat, tier: ResourceTier | null): string {
  if (tier === "Free & open resources only") return "Free";
  const budgetConscious = tier === "Budget-conscious mix";
  switch (format) {
    case "Mentorship & coaching":
      return budgetConscious
        ? "Budget-friendly: free peer-mentorship communities or informal coffee chats, instead of paid 1:1 coaching (which runs $75–300/mo)"
        : "Premium — roughly $75–300/mo, varies widely by provider";
    case "Live cohort classes":
      return budgetConscious
        ? "Budget-friendly: free community-run study groups or Meetup cohorts, instead of paid programs (which run $200–1,500)"
        : "Premium — roughly $200–1,500 per cohort, varies widely by provider";
    case "Video courses":
      return "Low-cost — free in audit mode, ~$30–60 for a certificate";
    case "Short courses & workshops":
      return "Wide range — free/low-cost options exist (community centers, Meetup groups, free trial sessions) alongside $50–300 for polished paid workshops";
    case "Professional certifications":
      return "Wide range — genuinely free options exist (Google Career Certificates, HubSpot Academy, freeCodeCamp) alongside $100–500 paid credentials";
    case "Hands-on projects":
      return "Free — uses your own work";
    case "Reading & self-study":
      return "Free–$20/mo depending on platform";
    case "Research & case studies":
      return "Free–$50 per report, most academic and case-study sources are free";
    case "Webinars & virtual events":
      return "Mostly free — occasional $10–50 for premium industry events";
    case "Peer learning":
      return "Free — costs your time, not money";
  }
}

export function successIndicator(dimension: string, targetLevel: number): string {
  return `You can point to one concrete example demonstrating ${dimension} at roughly this level (~${targetLevel}/100) — in a real conversation, review, or interview, not just self-assessment.`;
}
