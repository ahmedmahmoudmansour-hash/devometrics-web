"use client";

import { useState } from "react";

export type TabbedSection = { key: string; label: string; content: React.ReactNode };

// Generic tab switcher for pages that render several distinct visualizations
// of the same underlying data (first use: Employees page's table / pyramid /
// heatmap / leadership-ranking, per the 2026-08 UX audit — four topically
// coherent but separately-scrollable views collapsed into one at-a-glance
// page). All panels render (server-side, so no extra client fetch), only
// the active one is visible — simpler and safer than conditional mounting
// for content that's already fully server-rendered.
export default function TabbedSections({ tabs }: { tabs: TabbedSection[] }) {
  const [active, setActive] = useState(tabs[0]?.key);

  return (
    <div>
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 20,
          borderBottom: "1px solid var(--border)",
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(tab.key)}
              className="mono"
              style={{
                background: "none",
                border: "none",
                borderBottom: isActive ? "2px solid var(--teal)" : "2px solid transparent",
                marginBottom: -1,
                padding: "0 0 10px 0",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: isActive ? "var(--text)" : "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div key={tab.key} style={{ display: tab.key === active ? "block" : "none" }}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
