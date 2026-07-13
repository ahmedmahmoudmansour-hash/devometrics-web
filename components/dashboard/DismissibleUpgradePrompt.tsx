"use client";

import { useState, useTransition } from "react";
import { dismissUpgradePrompt } from "@/app/dashboard/actions";

// Thin dismiss chrome around the existing upgrade/trial/student cluster —
// wraps children rather than modifying them, so UpgradeToPremiumCard and
// PremiumTrialForm stay untouched. Optimistically hides on click; a failed
// save just means it reappears next visit, which is a safe failure mode
// for a "stop showing me this" preference.
export default function DismissibleUpgradePrompt({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const [, startTransition] = useTransition();

  if (hidden) return null;

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => {
          setHidden(true);
          startTransition(() => {
            void dismissUpgradePrompt();
          });
        }}
        aria-label="Hide upgrade prompts"
        title="Hide this"
        style={{
          position: "absolute",
          top: -10,
          right: -6,
          zIndex: 1,
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "var(--navy-mid)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)",
          fontSize: 13,
          lineHeight: 1,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ✕
      </button>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>{children}</div>
    </div>
  );
}
