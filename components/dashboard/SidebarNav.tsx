"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  UserCircle,
  Building2,
  ShieldCheck,
  LogOut,
  Lock,
  Search,
  ArrowLeftRight,
  ChevronDown,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import LocaleToggle from "@/components/LocaleToggle";
import { signOut } from "@/app/dashboard/actions";
import { OPEN_PALETTE_EVENT } from "@/components/dashboard/CommandPalette";
import { buildEmployeeMenu, isMainItemActive, sectionForPath, type EmployeeMainItem } from "@/components/dashboard/employeeNav";

export default function SidebarNav({
  savedTheme,
  isCompanyAdmin,
  isPlatformAdmin,
  isFreeTier,
  hasDirectReports,
  canSeeImpactCycle,
  hasOrgMembership,
  hasDirectoryEnabled,
  restrictedFeatures = [],
  nextOnboardingStep = null,
}: {
  savedTheme?: string | null;
  isCompanyAdmin: boolean;
  isPlatformAdmin: boolean;
  isFreeTier: boolean;
  hasDirectReports: boolean;
  canSeeImpactCycle: boolean;
  hasOrgMembership: boolean;
  hasDirectoryEnabled: boolean;
  restrictedFeatures?: string[];
  // Only rendered away from the home page — that page already shows the
  // full checklist this summarizes, so repeating it there would just be
  // a second, redundant "you're not done yet" nudge on the same screen.
  nextOnboardingStep?: { labelKey: string; href: string } | null;
}) {
  const t = useTranslations("sidebarNav");
  const tHome = useTranslations("dashboardHome");
  const pathname = usePathname();
  // A short main menu built around what the person does, then a collapsed "More" for the tools used less often. One shared
  // config (employeeNav.ts) drives this menu, the section tabs, the home page's "All tools" and the test that walks the map.
  const menu = buildEmployeeMenu({ hasDirectReports, canSeeImpactCycle, hasOrgMembership, hasDirectoryEnabled, restrictedFeatures });
  const homeItem = { href: "/dashboard", labelKey: "progress", icon: LayoutDashboard };
  // "More" opens by itself when the person is on one of its pages, so they never lose their place.
  const onMorePage = menu.more.some((i) => pathname === i.href || pathname?.startsWith(`${i.href}/`)) && !sectionForPath(pathname ?? "");

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
          ? "rgba(var(--amber-rgb),0.1)"
          : "rgba(var(--teal-rgb),0.1)"
        : "transparent",
      border: active
        ? accent === "amber"
          ? "1px solid rgba(var(--amber-rgb),0.3)"
          : "1px solid rgba(var(--teal-rgb),0.3)"
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

      {/* Only away from the home page (which already shows the full
          checklist this summarizes) — this exists specifically for a new
          employee who clicked into Coach/Tasks/etc. from the welcome tour
          and lost the "where do I start" thread once the checklist scrolled
          out of view. Disappears entirely once all 5 steps are done. */}
      {nextOnboardingStep && pathname !== "/dashboard" && (
        <Link
          href={nextOnboardingStep.href}
          className="dashboard-sidebar-label"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            margin: "0 0 14px",
            padding: "8px 14px",
            borderRadius: 8,
            background: "rgba(var(--teal-rgb),0.08)",
            border: "1px solid rgba(var(--teal-rgb),0.25)",
            textDecoration: "none",
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--teal)" }}>
            {t("continueSetup")}
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{tHome(nextOnboardingStep.labelKey)}</span>
        </Link>
      )}

      <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {[homeItem, ...menu.main].map((item) => (
          <Link key={`${item.labelKey}-${item.href}`} href={item.href} title={t(item.labelKey)} style={itemStyle(isMainItemActive(item as EmployeeMainItem, pathname ?? ""))}>
            <item.icon size={16} />
            <span className="dashboard-sidebar-label" style={{ flex: 1 }}>{t(item.labelKey)}</span>
          </Link>
        ))}

        {menu.more.length > 0 && (
          <details open={onMorePage} style={{ marginTop: 6 }}>
            <summary
              className="dashboard-sidebar-label"
              style={{
                listStyle: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.09em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                padding: "12px 14px 6px",
              }}
            >
              <ChevronDown size={13} />
              {t("more")}
            </summary>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {menu.more.map((item) => (
                <Link key={item.href} href={item.href} title={t(item.labelKey)} style={itemStyle(isActive(item.href))}>
                  <item.icon size={16} />
                  <span className="dashboard-sidebar-label" style={{ flex: 1 }}>{t(item.labelKey)}</span>
                  {item.premium && isFreeTier && <Lock size={12} className="dashboard-sidebar-label" style={{ color: "var(--amber)", flexShrink: 0 }} />}
                </Link>
              ))}
            </div>
          </details>
        )}

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
        {hasOrgMembership && (
          <Link href="/dashboard/profile" style={itemStyle(isActive("/dashboard/profile"))}>
            <UserCircle size={16} />
            <span className="dashboard-sidebar-label">{t("accountSettings")}</span>
          </Link>
        )}
        {isCompanyAdmin && (
          <>
            <Link href="/dashboard/company" style={itemStyle(isActive("/dashboard/company"), "amber")}>
              <Building2 size={16} />
              <span className="dashboard-sidebar-label">{t("company")}</span>
            </Link>
            <Link href="/dashboard/choose-workspace" style={itemStyle(isActive("/dashboard/choose-workspace"))}>
              <ArrowLeftRight size={16} />
              <span className="dashboard-sidebar-label">{t("switchWorkspace")}</span>
            </Link>
          </>
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
