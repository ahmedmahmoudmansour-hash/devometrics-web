"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { redeemPremiumTrialCode } from "@/lib/billing/trial";

export default function PremiumTrialForm() {
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ days: number } | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await redeemPremiumTrialCode(code);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSuccess({ days: result?.days ?? 14 });
      setCode("");
      router.refresh();
    });
  }

  if (success) {
    return (
      <div
        style={{
          background: "rgba(0,201,167,0.06)",
          border: "1px solid rgba(0,201,167,0.25)",
          borderRadius: 16,
          padding: 20,
          fontSize: 13,
          color: "var(--teal)",
        }}
      >
        Premium trial activated — you have full access for {success.days} days.
      </div>
    );
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
        Have a Premium trial code?
      </p>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        Unlocks full plan detail (longer horizons, named resources) for a limited time — for
        testers, before billing is live.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="text"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-label="Premium trial code"
          placeholder="Enter code"
          style={{
            flex: "1 1 160px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 13,
            color: "var(--text)",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={isPending}
          style={{
            background: "var(--teal)",
            color: "#0A0F1E",
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? "Checking…" : "Activate"}
        </button>
      </form>
      {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
