// Custom icon set for the Company Profile widget grid, replacing the stock
// Lucide icons used there before — Lucide's friendly rounded-outline style
// is what half of SaaS uses, which worked against the rest of the Instrument
// redesign's goal of not reading as generic. Every icon here shares one
// signature detail: a small filled "reading dot" wherever the shape
// measures something (a peak, a highlighted node, a needle tip) — the same
// idea as a gauge showing its current value. That's meant to read as
// precision/measurement, i.e. what the product actually does, rather than
// AI iconography (sparkles, robots, neural nets). Same `{ size }` prop
// contract as lucide-react icons so these drop in as direct replacements;
// stroke/fill use currentColor so they inherit whatever color wraps them.

type IconProps = { size?: number };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function EmployeesIcon({ size = 17 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <line x1="4" y1="6" x2="9" y2="6" />
      <line x1="4" y1="11" x2="13" y2="11" />
      <line x1="4" y1="16" x2="11" y2="16" />
      <line x1="4" y1="21" x2="15" y2="21" />
      <circle cx="19" cy="21" r="2.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function AnalyticsIcon({ size = 17 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <line x1="3" y1="21" x2="21" y2="21" />
      <line x1="3" y1="21" x2="3" y2="3" />
      <line x1="3" y1="16" x2="4.6" y2="16" />
      <line x1="3" y1="10.5" x2="4.6" y2="10.5" />
      <line x1="3" y1="5" x2="4.6" y2="5" />
      <path d="M5 18 L10.5 10.5 L14.5 14 L20 5" />
      <circle cx="20" cy="5" r="2.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function OrgChartIcon({ size = 17 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <circle cx="12" cy="5" r="2.1" fill="currentColor" stroke="none" />
      <circle cx="6" cy="14" r="1.5" />
      <circle cx="18" cy="14" r="1.5" />
      <circle cx="6" cy="21" r="1.5" />
      <circle cx="18" cy="21" r="1.5" />
      <line x1="12" y1="6.9" x2="7.2" y2="12.6" />
      <line x1="12" y1="6.9" x2="16.8" y2="12.6" />
      <line x1="6" y1="15.5" x2="6" y2="19.5" />
      <line x1="18" y1="15.5" x2="18" y2="19.5" />
    </svg>
  );
}

export function JobArchitectureIcon({ size = 17 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
      <circle cx="17" cy="17" r="2.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CompetenciesIcon({ size = 17 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M4 15 A8 8 0 0 1 20 15" />
      <line x1="4" y1="15" x2="4" y2="17.3" />
      <line x1="20" y1="15" x2="20" y2="17.3" />
      <line x1="12" y1="6.7" x2="12" y2="9" />
      <line x1="12" y1="15" x2="16.3" y2="10.3" />
      <circle cx="12" cy="15" r="2.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

// High Potential — a target/crosshair: potential is "how close to the
// center" rather than a generic star rating.
export function HighPotentialIcon({ size = 17 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <circle cx="12" cy="12" r="8.25" />
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2.5" x2="12" y2="5.5" />
      <line x1="12" y1="18.5" x2="12" y2="21.5" />
      <line x1="2.5" y1="12" x2="5.5" y2="12" />
      <line x1="18.5" y1="12" x2="21.5" y2="12" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Succession — an ascending stair of ticks, the top one filled: readiness
// climbing toward "ready now."
export function SuccessionIcon({ size = 17 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <line x1="3" y1="20" x2="8" y2="20" />
      <line x1="8" y1="20" x2="8" y2="15" />
      <line x1="8" y1="15" x2="13" y2="15" />
      <line x1="13" y1="15" x2="13" y2="10" />
      <line x1="13" y1="10" x2="18" y2="10" />
      <line x1="18" y1="10" x2="18" y2="6" />
      <circle cx="18" cy="4.6" r="2.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Scorecard — a segmented ring (KPI ring) with a dot marking current
// position, distinct from Competencies' half-circle needle gauge.
export function ScorecardIcon({ size = 17 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <circle cx="12" cy="12" r="8" strokeDasharray="4 3.2" />
      <circle cx="12" cy="4" r="2.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Hiring — viewfinder corner brackets around a center point: the candidate
// being evaluated, framed like an instrument sighting its target.
export function HiringIcon({ size = 17 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M3.5 8.5 V4.5 A1 1 0 0 1 4.5 3.5 H8.5" />
      <path d="M15.5 3.5 H19.5 A1 1 0 0 1 20.5 4.5 V8.5" />
      <path d="M20.5 15.5 V19.5 A1 1 0 0 1 19.5 20.5 H15.5" />
      <path d="M8.5 20.5 H4.5 A1 1 0 0 1 3.5 19.5 V15.5" />
      <circle cx="12" cy="12" r="2.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Knowledge Hub — a bookspine/ruler: stacked horizontal bars with a dot
// marking the most recently added.
export function KnowledgeHubIcon({ size = 17 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <line x1="4" y1="5" x2="17" y2="5" />
      <line x1="4" y1="10.5" x2="14" y2="10.5" />
      <line x1="4" y1="16" x2="20" y2="16" />
      <line x1="4" y1="21" x2="11" y2="21" />
      <circle cx="20" cy="16" r="2.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Performance Reviews — a checklist ledger, the last tick completed.
export function PerformanceReviewsIcon({ size = 17 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <line x1="8" y1="8.5" x2="16" y2="8.5" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <path d="M8 17.2 L10 19.2 L16 13.5" />
    </svg>
  );
}

// Surveys — a signal waveform, peak marked: capturing a live response.
export function SurveysIcon({ size = 17 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <line x1="2.5" y1="14" x2="6" y2="14" />
      <line x1="6" y1="14" x2="6" y2="18" />
      <line x1="6" y1="18" x2="9.5" y2="18" />
      <line x1="9.5" y1="18" x2="9.5" y2="6" />
      <line x1="9.5" y1="6" x2="13" y2="6" />
      <line x1="13" y1="6" x2="13" y2="16" />
      <line x1="13" y1="16" x2="16.5" y2="16" />
      <line x1="16.5" y1="16" x2="16.5" y2="10" />
      <line x1="16.5" y1="10" x2="21.5" y2="10" />
      <circle cx="21.5" cy="10" r="2.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Exit Interviews — mirrors EmployeesIcon's tally-rows language but the
// marked row trends down instead of up, matching "leaving," not "growing."
export function ExitInterviewsIcon({ size = 17 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <line x1="4" y1="21" x2="9" y2="21" />
      <line x1="4" y1="16" x2="13" y2="16" />
      <line x1="4" y1="11" x2="11" y2="11" />
      <line x1="4" y1="6" x2="15" y2="6" />
      <line x1="17" y1="6" x2="21" y2="10" />
      <line x1="21" y1="10" x2="21" y2="6.5" />
      <line x1="21" y1="10" x2="17.5" y2="10" />
    </svg>
  );
}

export const INSTRUMENT_WIDGET_ICONS = {
  Employees: EmployeesIcon,
  Analytics: AnalyticsIcon,
  OrgChart: OrgChartIcon,
  JobArchitecture: JobArchitectureIcon,
  Competencies: CompetenciesIcon,
  HighPotential: HighPotentialIcon,
  Succession: SuccessionIcon,
  Scorecard: ScorecardIcon,
  Hiring: HiringIcon,
  KnowledgeHub: KnowledgeHubIcon,
  PerformanceReviews: PerformanceReviewsIcon,
  Surveys: SurveysIcon,
  ExitInterviews: ExitInterviewsIcon,
};
