"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  ListChecks,
  Compass,
  Target,
  ClipboardList,
  FileText,
  LineChart,
  History,
  Drama,
  Sparkles,
  UserCircle,
  Building2,
  ShieldCheck,
  LogOut,
  Lock,
  NotebookPen,
  Route,
  Search,
  Milestone as MilestoneIcon,
  BadgeCheck,
  Users,
  ClipboardCheck,
  Library,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import LocaleToggle from "@/components/LocaleToggle";
import { signOut } from "@/app/dashboard/actions";
import { OPEN_PALETTE_EVENT } from "@/components/dashboard/CommandPalette";

type NavItem = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ size?: number }>;
  accent?: "teal" | "amber";
  premium?: boolean;
};

// Grouped by what the user is trying to DO, not by when features shipped —
// a 13-item flat list made even the flagship AI Coach hard to find. Section
// labels hide with the rest of the text when the sidebar collapses to
// icons-only on narrow screens.
function buildSections(
  hasDirectReports: boolean,
  hasManager: boolean,
  hasOrgMembership: boolean
): { labelKey: string | null; items: NavItem[] }[] {
  return [
    {
      labelKey: null,
      items: [{ href: "/dashboard", labelKey: "progress", icon: LayoutDashboard }],
    },
    {
      labelKey: "understandSection",
      items: [
        { href: "/dashboard/discovery", labelKey: "discovery", icon: Compass },
        { href: "/dashboard/gap-analysis", labelKey: "gapAnalysis", icon: Target },
        { href: "/dashboard/assessments", labelKey: "assessments", icon: ClipboardList },
        { href: "/dashboard/resume", labelKey: "resume", icon: FileText, premium: true },
        { href: "/dashboard/scorecard", labelKey: "scorecard", icon: LineChart },
        // Only shown to someone with an actual manager assigned in the Org
        // Chart — with no manager, this page can never have anything on it
        // (no one to give a Manager's Perspective), so the link is just
        // permanent clutter otherwise, not a real feature they can use.
        ...(hasManager ? [{ href: "/dashboard/impact-cycle", labelKey: "impactCycle", icon: ClipboardCheck }] : []),
        // Only shown to a real reporting-line manager (migration 0078) —
        // an individual contributor with no reports has nothing to do here.
        ...(hasDirectReports ? [{ href: "/dashboard/my-team", labelKey: "myTeam", icon: Users }] : []),
      ],
    },
    {
      labelKey: "growSection",
      items: [
        { href: "/dashboard/coach", labelKey: "aiCoach", icon: Sparkles },
        { href: "/dashboard/roleplay", labelKey: "practiceScenarios", icon: Drama, premium: true },
        { href: "/dashboard/career-paths", labelKey: "careerPaths", icon: Route },
        { href: "/dashboard/plans", labelKey: "myDevelopment", icon: MilestoneIcon },
        { href: "/dashboard/journey", labelKey: "myJourney", icon: History },
      ],
    },
    {
      labelKey: "organizeSection",
      items: [
        { href: "/dashboard/tasks", labelKey: "tasksCalendar", icon: ListChecks },
        { href: "/dashboard/notes", labelKey: "workspace", icon: NotebookPen },
        { href: "/dashboard/certifications", labelKey: "certifications", icon: BadgeCheck },
        { href: "/dashboard/accountability", labelKey: "accountabilityGroups", icon: Users },
        // Only relevant to someone actually part of a company workspace —
        // an individual account will never have anything assigned here.
        ...(hasOrgMembership ? [{ href: "/dashboard/knowledge-hub", labelKey: "knowledgeHub", icon: Library }] : []),
      ],
    },
  ];
}

export default function SidebarNav({
  savedTheme,
  isCompanyAdmin,
  isPlatformAdmin,
  isFreeTier,
  hasDirectReports,
  hasManager,
  hasOrgMembership,
}: {
  savedTheme?: string | null;
  isCompanyAdmin: boolean;
  isPlatformAdmin: boolean;
  isFreeTier: boolean;
  hasDirectReports: boolean;
  hasManager: boolean;
  hasOrgMembership: boolean;
}) {
  const t = useTranslations("sidebarNav");
  const pathname = usePathname();
  const sections = buildSections(hasDirectReports, hasManager, hasOrgMembership);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  function itemStyle(active: boolean, accent?: "teal" | "amber"): React.CSSProperties {
    const accentColor = accent === "amber" ? "var(--amber)" : "var(--teal)";
    return {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "9px 14px",
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 600,
      textDecoration: "none",
      color: active ? accentColor : "var(--text-muted)",
      background: active
        ? accent === "amber"
          ? "rgba(240,184,64,0.1)"
          : "rgba(0,201,167,0.1)"
        : "transparent",
      border: active
        ? accent === "amber"
          ? "1px solid rgba(240,184,64,0.3)"
          : "1px solid rgba(0,201,167,0.3)"
        : "1px solid transparent",
      whiteSpace: "nowrap",
      overflow: "hidden",
    };
  }

  return (
    <aside
      className="dashboard-sidebar"
      style={{
        position: "sticky",
        top: 0,
        alignSelf: "flex-start",
        height: "100vh",
        width: 224,
        flexShrink: 0,
        borderRight: "1px solid var(--border)",
        background: "var(--navy-mid)",
        display: "flex",
        flexDirection: "column",
        padding: "20px 12px",
        overflowY: "auto",
      }}
    >
      <Link
        href="/"
        className="dashboard-sidebar-logo"
        style={{
          color: "var(--teal)",
          fontSize: 15,
          fontWeight: 700,
          textDecoration: "none",
          padding: "0 14px",
          marginBottom: 20,
        }}
      >
        Devometrics
      </Link>

      <button
        type="button"
        title={t("searchTooltip")}
        onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: "0 0 14px",
          padding: "8px 14px",
          borderRadius: 8,
          fontSize: 13,
          color: "var(--text-muted)",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--border)",
          cursor: "pointer",
          width: "100%",
        }}
      >
        <Search size={15} />
        <span className="dashboard-sidebar-label" style={{ flex: 1, textAlign: "left" }}>{t("search")}</span>
        <kbd
          className="dashboard-sidebar-label"
          style={{
            fontSize: 10,
            fontFamily: "inherit",
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: "1px 5px",
          }}
        >
          Ctrl K
        </kbd>
      </button>

      <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {sections.map((section, i) => (
          <div key={section.labelKey ?? `section-${i}`} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {section.labelKey && (
              <p
                className="dashboard-sidebar-label"
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.09em",
                  textTransform: "uppercase",
                  color: "var(--text)",
                  padding: "12px 14px 2px",
                }}
              >
                {t(section.labelKey)}
              </p>
            )}
            {section.items.map((item) => (
              <Link key={item.href} href={item.href} title={t(item.labelKey)} style={itemStyle(isActive(item.href))}>
                <item.icon size={16} />
                <span className="dashboard-sidebar-label" style={{ flex: 1 }}>{t(item.labelKey)}</span>
                {item.premium && isFreeTier && (
                  <Lock size={12} className="dashboard-sidebar-label" style={{ color: "var(--amber)", flexShrink: 0 }} />
                )}
              </Link>
            ))}
          </div>
        ))}

        <p
          className="dashboard-sidebar-label"
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            color: "var(--text)",
            padding: "12px 14px 2px",
          }}
        >
          {t("accountSection")}
        </p>
        <Link href="/dashboard/profile" style={itemStyle(isActive("/dashboard/profile"))}>
          <UserCircle size={16} />
          <span className="dashboard-sidebar-label">{t("profile")}</span>
        </Link>
        {isCompanyAdmin && (
          <Link href="/dashboard/company" style={itemStyle(isActive("/dashboard/company"), "amber")}>
            <Building2 size={16} />
            <span className="dashboard-sidebar-label">{t("company")}</span>
          </Link>
        )}
        {isPlatformAdmin && (
          <Link href="/dashboard/admin" style={itemStyle(isActive("/dashboard/admin"), "amber")}>
            <ShieldCheck size={16} />
            <span className="dashboard-sidebar-label">{t("admin")}</span>
          </Link>
        )}
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <ThemeToggle savedTheme={savedTheme} />
        <LocaleToggle />
        <form action={signOut} style={{ flex: 1 }}>
          <button
            type="submit"
            className="dashboard-sidebar-label"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 13,
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            <LogOut size={14} /> {t("logOut")}
          </button>
        </form>
      </div>
    </aside>
  );
}
