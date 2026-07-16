import Link from "next/link";
import {
  Users,
  Network,
  SlidersHorizontal,
  BarChart3,
  Star,
  TrendingUp,
  Gauge,
  MessageSquare,
} from "lucide-react";

export type CompanyWidget = {
  key: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number }>;
  stat: string;
};

// Zoho-style launcher grid for the company home tab — every key area as its
// own icon-led tile with a live stat, instead of the plain text nav tabs
// being the only way to see what's inside each area. CompanyNavTabs stays
// as the persistent in-page nav; this is the "at a glance" home view on top
// of it, same relationship Zoho's own app-launcher home has to its sidebar.
export default function CompanyWidgetGrid({ widgets }: { widgets: CompanyWidget[] }) {
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
      {widgets.map((w) => (
        <Link
          key={w.key}
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
              background: "rgba(0,201,167,0.1)",
              border: "1px solid rgba(0,201,167,0.2)",
              marginBottom: 12,
            }}
          >
            <w.icon size={17} />
          </span>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 3 }}>{w.label}</h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{w.stat}</p>
        </Link>
      ))}
    </div>
  );
}

export const COMPANY_WIDGET_ICONS = {
  Users,
  Network,
  SlidersHorizontal,
  BarChart3,
  Star,
  TrendingUp,
  Gauge,
  MessageSquare,
};
