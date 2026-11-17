"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { useDashboardNav } from "@/components/dashboard/DashboardNavContext";
import { EMPLOYEE_SECTIONS, sectionForPath, sectionTabs } from "@/components/dashboard/employeeNav";

// The row of tabs at the top of a page that belongs to a menu section (My Assessments, My Development, AI Coach, My Profile), so the pages
// that go together are one click apart without each needing its own menu entry. Shown only on those pages, and only the tabs this person
// may use. Printed pages leave it out.
export default function EmployeeSectionTabs() {
  const nav = useDashboardNav();
  const pathname = usePathname();
  const t = useTranslations("sidebarNav");
  if (!nav || !pathname) return null;
  const key = sectionForPath(pathname);
  if (!key) return null;
  const tabs = sectionTabs(key, nav);
  if (tabs.length < 2) return null;

  return (
    <nav className="no-print" aria-label={t(EMPLOYEE_SECTIONS[key].menuLabelKey)} style={{ padding: "20px 24px 0" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 14px",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
                color: active ? "var(--teal)" : "var(--text-muted)",
                borderBottom: `2px solid ${active ? "var(--teal)" : "transparent"}`,
                marginBottom: -1,
              }}
            >
              {t(tab.labelKey)}
              {tab.premium && nav.isFreeTier && <Lock size={11} style={{ color: "var(--amber)" }} />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
