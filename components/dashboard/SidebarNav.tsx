"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { signOut } from "@/app/dashboard/actions";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  accent?: "teal" | "amber";
  premium?: boolean;
};

const PRIMARY_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Progress", icon: LayoutDashboard },
  { href: "/dashboard/tasks", label: "Tasks", icon: ListChecks },
  { href: "/dashboard/discovery", label: "Discovery", icon: Compass },
  { href: "/dashboard/gap-analysis", label: "Gap Analysis", icon: Target },
  { href: "/dashboard/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/dashboard/resume", label: "Resume", icon: FileText, premium: true },
  { href: "/dashboard/scorecard", label: "Scorecard", icon: LineChart },
  { href: "/dashboard/journey", label: "Journey", icon: History },
  { href: "/dashboard/roleplay", label: "Scenarios", icon: Drama, premium: true },
];

export default function SidebarNav({
  savedTheme,
  isCompanyAdmin,
  isPlatformAdmin,
  isFreeTier,
}: {
  savedTheme?: string | null;
  isCompanyAdmin: boolean;
  isPlatformAdmin: boolean;
  isFreeTier: boolean;
}) {
  const pathname = usePathname();

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

      <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {PRIMARY_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} style={itemStyle(isActive(item.href))}>
            <item.icon size={16} />
            <span className="dashboard-sidebar-label" style={{ flex: 1 }}>{item.label}</span>
            {item.premium && isFreeTier && (
              <Lock size={12} className="dashboard-sidebar-label" style={{ color: "var(--amber)", flexShrink: 0 }} />
            )}
          </Link>
        ))}

        {isCompanyAdmin && (
          <Link href="/dashboard/company" style={itemStyle(isActive("/dashboard/company"), "amber")}>
            <Building2 size={16} />
            <span className="dashboard-sidebar-label">Company</span>
          </Link>
        )}

        <Link href="/dashboard/coach" style={itemStyle(isActive("/dashboard/coach"))}>
          <Sparkles size={16} />
          <span className="dashboard-sidebar-label">AI Coach</span>
        </Link>

        <Link href="/dashboard/profile" style={itemStyle(isActive("/dashboard/profile"))}>
          <UserCircle size={16} />
          <span className="dashboard-sidebar-label">Profile</span>
        </Link>

        {isPlatformAdmin && (
          <Link href="/dashboard/admin" style={itemStyle(isActive("/dashboard/admin"), "amber")}>
            <ShieldCheck size={16} />
            <span className="dashboard-sidebar-label">Admin</span>
          </Link>
        )}
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <ThemeToggle savedTheme={savedTheme} />
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
            <LogOut size={14} /> Log out
          </button>
        </form>
      </div>
    </aside>
  );
}
