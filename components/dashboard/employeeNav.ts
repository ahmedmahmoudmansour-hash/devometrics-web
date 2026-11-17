import {
  Compass,
  ClipboardList,
  FileText,
  Sparkles,
  ListChecks,
  NotebookPen,
  Milestone as MilestoneIcon,
  Users,
  ClipboardCheck,
  Library,
  CalendarDays,
  Contact,
  IdCard,
  Drama,
} from "lucide-react";
import { hrModulesHidden } from "@/lib/organizations/hrModules";

// ONE source for the employee menu, shared by the sidebar, the section tabs, the home page's "All tools" list and the test that walks the
// navigation map (docs: Devometrics-Navigation-Map-v1.xlsx). The idea: a person sees a SMALL main menu built around what they do, and
// everything else is one click away inside a section (as a tab) or under "More". Nothing is removed; where something is reached from
// changes, and visibility follows permissions, assignments and the company's enabled modules.
//
//   Main:  Home | My Assessments | My Development | AI Coach | Tasks & Calendar | My Profile  (+ My Team for managers)
//   Tabs:  each of the sections above groups the pages that belong together
//   More:  the tools used less often

export type EmployeeNavFlags = {
  hasDirectReports: boolean;
  canSeeImpactCycle: boolean;
  hasOrgMembership: boolean;
  hasDirectoryEnabled: boolean;
  restrictedFeatures: string[];
};

type Icon = React.ComponentType<{ size?: number }>;

export type EmployeeNavItem = {
  href: string;
  labelKey: string;
  icon: Icon;
  premium?: boolean;
  // Matches a RestrictableFeature key (lib/organizations/featureAccess.ts); items without one are never hidden by a restriction.
  featureKey?: string;
};

export type SectionKey = "assessments" | "development" | "coach" | "profile";

type Tab = { href: string; labelKey: string; premium?: boolean; featureKey?: string; when?: (f: EmployeeNavFlags) => boolean };

type Section = {
  menuLabelKey: string;
  icon: Icon;
  // Where the main menu item goes (some sections lead somewhere else for people outside a company).
  entry: (f: EmployeeNavFlags) => string;
  tabs: Tab[];
  // Other pages that belong to the section but are not tabs (a page reached from a list), so the menu keeps the section highlighted.
  alsoUnder?: string[];
  featureKey?: string;
};

const inCompany = (f: EmployeeNavFlags) => f.hasOrgMembership;

export const EMPLOYEE_SECTIONS: Record<SectionKey, Section> = {
  assessments: {
    menuLabelKey: "myAssessments",
    icon: ClipboardList,
    entry: () => "/dashboard/assessments",
    tabs: [
      { href: "/dashboard/assessments", labelKey: "tabAssessments" },
      { href: "/dashboard/role-assessment", labelKey: "tabRoleKnowledge", when: inCompany },
      { href: "/dashboard/scorecard", labelKey: "tabScorecard" },
    ],
    alsoUnder: ["/dashboard/knowledge-check", "/dashboard/personality"],
  },
  development: {
    menuLabelKey: "myDevelopment",
    icon: MilestoneIcon,
    entry: () => "/dashboard/plans",
    tabs: [
      { href: "/dashboard/plans", labelKey: "tabPlans" },
      { href: "/dashboard/gap-analysis", labelKey: "tabGapAnalysis" },
      { href: "/dashboard/career-paths", labelKey: "tabCareerPaths", featureKey: "career_development" },
      { href: "/dashboard/journey", labelKey: "tabJourney" },
      { href: "/dashboard/knowledge-hub", labelKey: "tabLearning", featureKey: "knowledge_hub", when: inCompany },
      { href: "/dashboard/job-applications", labelKey: "tabJobApplications" },
    ],
  },
  coach: {
    menuLabelKey: "aiCoach",
    icon: Sparkles,
    entry: () => "/dashboard/coach",
    featureKey: "ai_coaching",
    tabs: [
      { href: "/dashboard/coach", labelKey: "tabCoach", featureKey: "ai_coaching" },
      { href: "/dashboard/roleplay", labelKey: "tabPractice", premium: true, featureKey: "roleplay" },
    ],
  },
  profile: {
    menuLabelKey: "myProfile",
    icon: IdCard,
    // A company member's personal file; someone outside a company has only their account page.
    entry: (f) => (f.hasOrgMembership ? "/dashboard/my-file" : "/dashboard/profile"),
    tabs: [
      { href: "/dashboard/my-file", labelKey: "tabMyFile", when: inCompany },
      { href: "/dashboard/certifications", labelKey: "tabCertifications" },
      { href: "/dashboard/profile", labelKey: "tabAccount" },
    ],
  },
};

export const SECTION_ORDER: SectionKey[] = ["assessments", "development", "coach", "profile"];

export type EmployeeMainItem = EmployeeNavItem & { section?: SectionKey };

const allowed = (restricted: Set<string>, featureKey?: string) => !featureKey || !restricted.has(featureKey);

function underPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// The pages that belong to a section: its tabs (that this person may see) and the extra pages that sit under it.
export function sectionTabs(key: SectionKey, flags: EmployeeNavFlags): { href: string; labelKey: string; premium?: boolean }[] {
  const restricted = new Set(flags.restrictedFeatures);
  return EMPLOYEE_SECTIONS[key].tabs
    .filter((t) => (t.when ? t.when(flags) : true) && allowed(restricted, t.featureKey))
    .map(({ href, labelKey, premium }) => ({ href, labelKey, premium }));
}

// Which section a page belongs to, or null (Home, Tasks, More tools, company pages and so on).
export function sectionForPath(pathname: string): SectionKey | null {
  for (const key of SECTION_ORDER) {
    const s = EMPLOYEE_SECTIONS[key];
    const hrefs = [...s.tabs.map((t) => t.href), ...(s.alsoUnder ?? [])];
    if (hrefs.some((h) => underPath(pathname, h))) return key;
  }
  return null;
}

// The main menu, in order. A section whose feature the company switched off is left out; My Team is for managers only.
export function buildEmployeeMenu(flags: EmployeeNavFlags): { main: EmployeeMainItem[]; more: EmployeeNavItem[] } {
  const restricted = new Set(flags.restrictedFeatures);
  const main: EmployeeMainItem[] = [];
  for (const key of ["assessments", "development", "coach"] as SectionKey[]) {
    const s = EMPLOYEE_SECTIONS[key];
    if (!allowed(restricted, s.featureKey)) continue;
    main.push({ href: s.entry(flags), labelKey: s.menuLabelKey, icon: s.icon, section: key });
  }
  main.push({ href: "/dashboard/tasks", labelKey: "tasksCalendar", icon: ListChecks });
  main.push({ href: EMPLOYEE_SECTIONS.profile.entry(flags), labelKey: "myProfile", icon: IdCard, section: "profile" });
  if (flags.hasDirectReports) main.push({ href: "/dashboard/my-team", labelKey: "myTeam", icon: Users });

  const more: EmployeeNavItem[] = [
    // Prominent on Home while onboarding is unfinished; here afterwards.
    { href: "/dashboard/discovery", labelKey: "discovery", icon: Compass },
    { href: "/dashboard/resume", labelKey: "resume", icon: FileText, premium: true, featureKey: "resume_intelligence" },
    { href: "/dashboard/roleplay", labelKey: "practiceScenarios", icon: Drama, premium: true, featureKey: "roleplay" },
    { href: "/dashboard/notes", labelKey: "workspace", icon: NotebookPen },
    { href: "/dashboard/accountability", labelKey: "accountabilityGroups", icon: Users },
  ];
  if (flags.hasOrgMembership) {
    // Employee self-service (time off, HR letters) is hidden together with the HR modules.
    if (!hrModulesHidden()) more.push({ href: "/dashboard/leave", labelKey: "services", icon: CalendarDays });
    more.push({ href: "/dashboard/knowledge-hub", labelKey: "knowledgeHub", icon: Library, featureKey: "knowledge_hub" });
    // Only while a review is open for the person, or they have a manager (an assigned review must always be reachable).
    if (flags.canSeeImpactCycle) more.push({ href: "/dashboard/impact-cycle", labelKey: "impactCycle", icon: ClipboardCheck, featureKey: "performance_review" });
    if (flags.hasDirectoryEnabled) more.push({ href: "/dashboard/directory", labelKey: "directory", icon: Contact });
  }
  return { main, more: more.filter((i) => allowed(restricted, i.featureKey)) };
}

// Every page a person can reach from the menu structure: Home, the main items, the tabs of each section and the More list. The test
// that walks the navigation map checks every feature in it appears here (at most two clicks).
export function employeeReachableHrefs(flags: EmployeeNavFlags): string[] {
  const { main, more } = buildEmployeeMenu(flags);
  const tabs = SECTION_ORDER.flatMap((k) => sectionTabs(k, flags).map((t) => t.href));
  return [...new Set(["/dashboard", ...main.map((m) => m.href), ...tabs, ...more.map((m) => m.href)])];
}

// For the sidebar: is this main item the one the person is on?
export function isMainItemActive(item: EmployeeMainItem, pathname: string): boolean {
  if (item.href === "/dashboard") return pathname === "/dashboard";
  if (item.section) return sectionForPath(pathname) === item.section;
  return underPath(pathname, item.href);
}
