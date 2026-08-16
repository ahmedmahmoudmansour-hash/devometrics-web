"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

// Same sticky tab-bar look as the homepage's SectionTabs, but each item is
// a real route under /enterprise/* instead of a client-state panel swap —
// separate, bookmarkable, back/forward-friendly pages, styled to read as
// the same tab system the homepage already uses. Active state comes from
// the URL (usePathname), not component state, since each "tab" is really
// a distinct page now.
export default function EnterpriseSectionNav() {
  const pathname = usePathname();
  const tCommon = useTranslations("common");
  const t = useTranslations("enterprisePage");

  const tabs = [
    { href: "/enterprise/decisions", label: tCommon("decisions") },
    { href: "/enterprise/methodology", label: tCommon("methodology") },
    { href: "/enterprise/live-demo", label: tCommon("liveDemo") },
    { href: "/enterprise/succession", label: t("navSuccession") },
    { href: "/enterprise/capabilities", label: t("navCapabilities") },
    { href: "/enterprise/how-it-works", label: tCommon("howItWorks") },
  ];

  return (
    <div
      role="tablist"
      style={{
        position: "sticky",
        top: 72,
        zIndex: 30,
        background: "var(--nav-scrolled-bg, var(--navy))",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          gap: 8,
          overflowX: "auto",
        }}
      >
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              role="tab"
              aria-selected={isActive}
              style={{
                borderBottom: isActive ? "2px solid var(--teal)" : "2px solid transparent",
                marginBottom: -1,
                padding: "18px 4px",
                marginInline: 14,
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.01em",
                color: isActive ? "var(--text)" : "var(--text-muted)",
                whiteSpace: "nowrap",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
