import {
  Compass,
  Target,
  ClipboardList,
  FileText,
  LineChart,
  History,
  Drama,
  Sparkles,
  ListChecks,
  NotebookPen,
  Route,
  Milestone as MilestoneIcon,
  Users,
  ClipboardCheck,
  Library,
  CalendarDays,
  Contact,
} from "lucide-react";

// One source for the employee-facing tiles, shared by the sidebar sections
// and the home page's tile hub so the two can never drift apart. Grouped by
// what the person is trying to do, not by when features shipped:
//   growth    - understand where you stand
//   coaching  - get better at it
//   work      - your day-to-day
//   company   - things only a company member has (Services, Directory, ...)
export type EmployeeNavItem = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ size?: number }>;
  premium?: boolean;
  // Matches a RestrictableFeature key (lib/organizations/featureAccess.ts) —
  // items without one are never hidden by a feature restriction.
  featureKey?: string;
};

export type EmployeeTileKey = "growth" | "coaching" | "work" | "company";

export type EmployeeTile = { key: EmployeeTileKey; items: EmployeeNavItem[] };

export type EmployeeNavFlags = {
  hasDirectReports: boolean;
  canSeeImpactCycle: boolean;
  hasOrgMembership: boolean;
  hasDirectoryEnabled: boolean;
  restrictedFeatures: string[];
};

export function buildEmployeeTiles(flags: EmployeeNavFlags): EmployeeTile[] {
  const { hasDirectReports, canSeeImpactCycle, hasOrgMembership, hasDirectoryEnabled } = flags;
  const restricted = new Set(flags.restrictedFeatures);

  const tiles: EmployeeTile[] = [
    {
      key: "growth",
      items: [
        // Order matches the dashboard's OnboardingChecklist (Discovery ->
        // Assessments -> Gap Analysis); Gap Analysis is deliberately last of
        // the three — the CV/target-role step that produces the score other
        // features consume.
        { href: "/dashboard/discovery", labelKey: "discovery", icon: Compass },
        { href: "/dashboard/assessments", labelKey: "assessments", icon: ClipboardList },
        { href: "/dashboard/gap-analysis", labelKey: "gapAnalysis", icon: Target },
        { href: "/dashboard/resume", labelKey: "resume", icon: FileText, premium: true, featureKey: "resume_intelligence" },
        { href: "/dashboard/scorecard", labelKey: "scorecard", icon: LineChart },
      ],
    },
    {
      key: "coaching",
      items: [
        { href: "/dashboard/coach", labelKey: "aiCoach", icon: Sparkles, featureKey: "ai_coaching" },
        { href: "/dashboard/roleplay", labelKey: "practiceScenarios", icon: Drama, premium: true, featureKey: "roleplay" },
        { href: "/dashboard/career-paths", labelKey: "careerPaths", icon: Route, featureKey: "career_development" },
        { href: "/dashboard/plans", labelKey: "myDevelopment", icon: MilestoneIcon },
        { href: "/dashboard/journey", labelKey: "myJourney", icon: History },
      ],
    },
    {
      key: "work",
      items: [
        { href: "/dashboard/tasks", labelKey: "tasksCalendar", icon: ListChecks },
        { href: "/dashboard/notes", labelKey: "workspace", icon: NotebookPen },
        { href: "/dashboard/accountability", labelKey: "accountabilityGroups", icon: Users },
      ],
    },
  ];

  // Only for someone actually part of a company workspace — an individual
  // account has nothing assigned here.
  if (hasOrgMembership) {
    tiles.push({
      key: "company",
      items: [
        // Employee self-service (time off + HR letters), labelled Services
        // since it bundles unrelated requests, not leave alone.
        { href: "/dashboard/leave", labelKey: "services", icon: CalendarDays },
        // Off by default per org (organizations.directory_enabled, 0175).
        ...(hasDirectoryEnabled ? [{ href: "/dashboard/directory", labelKey: "directory", icon: Contact }] : []),
        { href: "/dashboard/knowledge-hub", labelKey: "knowledgeHub", icon: Library, featureKey: "knowledge_hub" },
        // Shown when there's a real manager to give a Manager's Perspective,
        // OR a review already exists regardless (an admin can assign one to
        // someone whose manager is a vacant structural position) — an
        // assigned review must always be reachable.
        ...(canSeeImpactCycle ? [{ href: "/dashboard/impact-cycle", labelKey: "impactCycle", icon: ClipboardCheck, featureKey: "performance_review" }] : []),
        // Only for a real reporting-line manager (migration 0078).
        ...(hasDirectReports ? [{ href: "/dashboard/my-team", labelKey: "myTeam", icon: Users }] : []),
      ],
    });
  }

  // Drop anything the company (or an admin, per person/department) has
  // restricted, and any tile left empty.
  return tiles
    .map((tile) => ({ ...tile, items: tile.items.filter((i) => !i.featureKey || !restricted.has(i.featureKey)) }))
    .filter((tile) => tile.items.length > 0);
}
