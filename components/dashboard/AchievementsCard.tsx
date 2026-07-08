"use client";

import { useState, useTransition } from "react";
import { updateBadgesEnabled } from "@/app/dashboard/actions";
import { ACHIEVEMENTS, type AchievementKey } from "@/lib/achievements/catalog";

const card: React.CSSProperties = {
  background: "var(--navy-mid)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: 24,
};

const linkButton: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--text-muted)",
  fontSize: 12,
  cursor: "pointer",
  textDecoration: "underline",
};

export default function AchievementsCard({
  earnedKeys,
  badgesEnabled,
}: {
  earnedKeys: AchievementKey[];
  badgesEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(badgesEnabled);
  const [isPending, startTransition] = useTransition();
  const earnedSet = new Set(earnedKeys);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(() => {
      updateBadgesEnabled(next);
    });
  }

  if (!enabled) {
    return (
      <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Achievements are hidden on your dashboard.</p>
        <button type="button" onClick={toggle} disabled={isPending} style={linkButton}>
          Show achievements
        </button>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Achievements</h2>
        <button type="button" onClick={toggle} disabled={isPending} style={linkButton}>
          Hide achievements
        </button>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 18 }}>
        {earnedSet.size} of {ACHIEVEMENTS.length} unlocked
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
        {ACHIEVEMENTS.map((a) => {
          const earned = earnedSet.has(a.key);
          return (
            <div
              key={a.key}
              title={a.description}
              style={{
                background: earned ? "rgba(0,201,167,0.08)" : "rgba(255,255,255,0.03)",
                border: earned ? "1px solid rgba(0,201,167,0.3)" : "1px solid var(--border)",
                borderRadius: 12,
                padding: "14px 10px",
                textAlign: "center",
                opacity: earned ? 1 : 0.45,
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 6 }}>{a.icon}</div>
              <p style={{ fontSize: 12, fontWeight: 700, color: earned ? "var(--teal)" : "var(--text-muted)" }}>
                {a.label}
              </p>
              <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.4 }}>
                {a.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
