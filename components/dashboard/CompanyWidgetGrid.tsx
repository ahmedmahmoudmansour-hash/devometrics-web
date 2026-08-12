import Link from "next/link";
import { Fragment } from "react";
import {
  EmployeesIcon,
  AnalyticsIcon,
  OrgChartIcon,
  JobArchitectureIcon,
  CompetenciesIcon,
  HighPotentialIcon,
  SuccessionIcon,
  ScorecardIcon,
  SurveysIcon,
  PerformanceReviewsIcon,
  KnowledgeHubIcon,
  HiringIcon,
  ExitInterviewsIcon,
} from "@/components/icons/InstrumentIcons";

export type CompanyWidget = {
  key: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number }>;
  stat: string;
  // Matches one of CompanyNavTabs' 5 group labels (Overview, Structure,
  // Talent, Hiring & Growth, Performance & Feedback) verbatim — the grid
  // used to render as one flat, ungrouped run of tiles while the nav
  // directly above it showed the same items clustered under labeled
  // headers, which read as two different orderings of the same taxonomy.
  // Rendering the same group boundaries here (in the same sequence) keeps
  // both views visibly in sync.
  group: string;
};

// Zoho-style launcher grid for the company home tab — every key area as its
// own icon-led tile with a live stat, instead of the plain text nav tabs
// being the only way to see what's inside each area. CompanyNavTabs stays
// as the persistent in-page nav; this is the "at a glance" home view on top
// of it, same relationship Zoho's own app-launcher home has to its sidebar.
export default function CompanyWidgetGrid({ widgets }: { widgets: CompanyWidget[] }) {
  const seenGroups = new Set<string>();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 1,
        background: "var(--border)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        overflow: "hidden",
        marginBottom: 24,
      }}
    >
      {widgets.map((w) => {
        const isNewGroup = !seenGroups.has(w.group);
        seenGroups.add(w.group);
        return (
          <Fragment key={w.key}>
            {isNewGroup && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  background: "var(--navy)",
                  padding: "10px 20px",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                }}
              >
                {w.group}
              </div>
            )}
            <Link
              href={w.href}
              className="card-hover"
              style={{
                display: "block",
                background: "var(--navy-mid)",
                padding: 20,
                textDecoration: "none",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  color: "var(--teal)",
                  background: "rgba(var(--teal-rgb),0.1)",
                  border: "1px solid rgba(var(--teal-rgb),0.2)",
                  marginBottom: 12,
                }}
              >
                <w.icon size={17} />
              </span>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 3 }}>{w.label}</h3>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{w.stat}</p>
            </Link>
          </Fragment>
        );
      })}
    </div>
  );
}

// Key names kept identical to the old lucide-react map (Users, Network,
// etc.) even though they now point at the custom Instrument icon set below
// — page.tsx references COMPANY_WIDGET_ICONS.Users and so on, and keeping
// the names stable means this is the only file that needed to change.
export const COMPANY_WIDGET_ICONS = {
  Users: EmployeesIcon,
  Network: JobArchitectureIcon,
  ListTree: OrgChartIcon,
  SlidersHorizontal: CompetenciesIcon,
  BarChart3: AnalyticsIcon,
  Star: HighPotentialIcon,
  TrendingUp: SuccessionIcon,
  Gauge: ScorecardIcon,
  MessageSquare: SurveysIcon,
  ClipboardCheck: PerformanceReviewsIcon,
  Library: KnowledgeHubIcon,
  Briefcase: HiringIcon,
  UserMinus: ExitInterviewsIcon,
};
