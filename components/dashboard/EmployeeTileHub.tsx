"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Sprout, Sparkles, Briefcase, Building2, ChevronRight, Lock } from "lucide-react";
import { useDashboardNav } from "@/components/dashboard/DashboardNavContext";
import { buildEmployeeTiles, type EmployeeTileKey } from "@/components/dashboard/employeeNav";

const TILE_ICONS: Record<EmployeeTileKey, React.ComponentType<{ size?: number }>> = {
  growth: Sprout,
  coaching: Sparkles,
  work: Briefcase,
  company: Building2,
};

// The employee home's "where do I go" tiles: the same four groups as the
// sidebar (one shared config), each listing its features as one-click rows.
// Reads the nav flags the layout already computed, so it respects premium
// locks, company/admin feature restrictions, manager-only items and the
// directory opt-in exactly like the sidebar does.
export default function EmployeeTileHub() {
  const nav = useDashboardNav();
  const t = useTranslations("sidebarNav");
  const tHub = useTranslations("employeeHome");
  if (!nav) return null;

  const tiles = buildEmployeeTiles(nav);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
      {tiles.map((tile) => {
        const Icon = TILE_ICONS[tile.key];
        return (
          <section
            key={tile.key}
            style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 18, display: "flex", flexDirection: "column" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  color: "var(--teal)",
                  background: "rgba(var(--teal-rgb),0.1)",
                  border: "1px solid rgba(var(--teal-rgb),0.2)",
                  flexShrink: 0,
                }}
              >
                <Icon size={18} />
              </span>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t(`tile_${tile.key}`)}</h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>{tHub(`tile_${tile.key}`)}</p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {tile.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="card-hover"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 4px",
                    borderTop: "1px solid var(--border)",
                    textDecoration: "none",
                  }}
                >
                  <item.icon size={15} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{t(item.labelKey)}</span>
                  {item.premium && nav.isFreeTier && <Lock size={12} style={{ color: "var(--amber)", flexShrink: 0 }} />}
                  <ChevronRight size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
