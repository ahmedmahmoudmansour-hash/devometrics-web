"use client";

import { useState, useTransition } from "react";
import { updateBigFiveSharing } from "@/app/dashboard/personality/actions";

export default function BigFiveSharingToggle({
  organizationName,
  initialShared,
}: {
  organizationName: string;
  initialShared: boolean;
}) {
  const [shared, setShared] = useState(initialShared);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !shared;
    setError(null);
    startTransition(async () => {
      const result = await updateBigFiveSharing(next);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setShared(next);
    });
  }

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <button
          type="button"
          role="switch"
          aria-checked={shared}
          onClick={toggle}
          disabled={isPending}
          style={{
            flexShrink: 0,
            marginTop: 2,
            width: 36,
            height: 20,
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
            background: shared ? "var(--teal)" : "rgba(255,255,255,0.15)",
            position: "relative",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: shared ? 18 : 2,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "#fff",
              transition: "left 0.15s",
            }}
          />
        </button>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
            Share with {organizationName}&apos;s admin
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.55 }}>
            Off by default. Your Big Five results are always private to you unless you turn this on —
            and it&apos;s for development conversations only. Devometrics doesn&apos;t use personality
            data for hiring, promotion, or compensation decisions, and neither should your admin.
          </p>
        </div>
      </div>
      {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
