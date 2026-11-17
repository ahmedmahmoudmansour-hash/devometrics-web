"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronRight, Lock } from "lucide-react";
import { useDashboardNav } from "@/components/dashboard/DashboardNavContext";
import { buildEmployeeMenu, sectionTabs } from "@/components/dashboard/employeeNav";

// "All tools" on the employee home: the same menu the sidebar shows, laid out as cards (each section with the pages inside it, then
// everything under More), from the same shared config, so the two can never disagree. Respects premium locks, company restrictions,
// manager-only items and the directory opt-in exactly like the sidebar.
export default function EmployeeTileHub() {
  const nav = useDashboardNav();
  const t = useTranslations("sidebarNav");
  if (!nav) return null;

  const { main, more } = buildEmployeeMenu(nav);
  const card: React.CSSProperties = { background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 18, display: "flex", flexDirection: "column" };
  const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", borderTop: "1px solid var(--border)", textDecoration: "none" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
      {main
        .filter((m) => m.section)
        .map((m) => {
          const tabs = m.section ? sectionTabs(m.section, nav) : [];
          return (
            <section key={m.labelKey} style={card}>
              <Link href={m.href} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", marginBottom: 6 }}>
                <m.icon size={17} />
                <h3 style={{ flex: 1, fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t(m.labelKey)}</h3>
                <ChevronRight size={15} style={{ color: "var(--text-muted)" }} />
              </Link>
              {tabs.map((tab) => (
                <Link key={tab.href} href={tab.href} className="card-hover" style={row}>
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{t(tab.labelKey)}</span>
                  {tab.premium && nav.isFreeTier && <Lock size={12} style={{ color: "var(--amber)", flexShrink: 0 }} />}
                  <ChevronRight size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                </Link>
              ))}
            </section>
          );
        })}
      <section style={card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: "0 0 6px" }}>{t("more")}</h3>
        {more.map((item) => (
          <Link key={item.href} href={item.href} className="card-hover" style={row}>
            <item.icon size={15} />
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{t(item.labelKey)}</span>
            {item.premium && nav.isFreeTier && <Lock size={12} style={{ color: "var(--amber)", flexShrink: 0 }} />}
            <ChevronRight size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          </Link>
        ))}
      </section>
    </div>
  );
}
