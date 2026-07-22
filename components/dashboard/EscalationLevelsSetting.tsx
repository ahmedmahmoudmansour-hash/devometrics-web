"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateReviewEscalationLevels } from "@/lib/organizations/actions";

export default function EscalationLevelsSetting({ organizationId, initialLevels }: { organizationId: string; initialLevels: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(initialLevels));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    const parsed = Number(value);
    if (parsed === initialLevels) return;
    startTransition(async () => {
      const result = await updateReviewEscalationLevels(organizationId, parsed);
      if (result?.error) setError(result.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginBottom: 24 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Review visibility up the Org Chart</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, marginBottom: 14, lineHeight: 1.6, maxWidth: 640 }}>
        The direct manager always has full read/write on a review. Raise this to also let managers further
        up the Org Chart see it and add their own co-sign comment — 1 means direct manager only, 3 means
        direct manager plus two skip-levels above them, and so on.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          type="number"
          min={1}
          max={10}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          disabled={isPending}
          style={{
            width: 70,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 13,
            color: "var(--text)",
            outline: "none",
          }}
        />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>levels (1–10)</span>
        {saved && <span style={{ fontSize: 12, color: "var(--teal)", fontWeight: 700 }}>Saved</span>}
      </div>
      {error && <p style={{ color: "#f87171", fontSize: 12.5, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
