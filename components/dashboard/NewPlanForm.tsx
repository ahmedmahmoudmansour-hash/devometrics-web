"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateQuickPlan } from "@/app/dashboard/gap-analysis/actions";

const HORIZON_OPTIONS: { value: "30-day" | "90-day" | "12-month" | "3-year"; label: string }[] = [
  { value: "30-day", label: "30 days" },
  { value: "90-day", label: "90 days" },
  { value: "12-month", label: "12 months" },
  { value: "3-year", label: "3 years" },
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
};

export default function NewPlanForm({
  subscriptionTier,
  existingPlanCount = 0,
}: {
  subscriptionTier: "free" | "premium" | "enterprise";
  existingPlanCount?: number;
}) {
  const [targetRole, setTargetRole] = useState("");
  const [cvText, setCvText] = useState("");
  const [horizon, setHorizon] = useState<"30-day" | "90-day" | "12-month" | "3-year">("30-day");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // When plans already exist, the form starts collapsed behind an explicit
  // "start another" action instead of sitting open by default — it was too
  // easy to generate an extra plan without meaning to (or without realizing
  // one already existed), leaving people with 2-4 overlapping plans and no
  // sense of which one to follow.
  const [expanded, setExpanded] = useState(existingPlanCount === 0);
  const router = useRouter();

  const isFree = subscriptionTier === "free";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await generateQuickPlan(targetRole, cvText, isFree ? "30-day" : horizon);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        style={{
          background: "var(--navy-mid)",
          border: "1px dashed var(--border)",
          borderRadius: 16,
          padding: "16px 20px",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-muted)",
          cursor: "pointer",
          width: "100%",
          textAlign: "center",
        }}
      >
        + Start another plan — you have {existingPlanCount} active plan{existingPlanCount === 1 ? "" : "s"} already;
        consider deleting one before adding more so it stays easy to track
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "var(--navy-mid)",
        border: "1px dashed var(--border)",
        borderRadius: 16,
        padding: 28,
      }}
    >
      <p style={{ fontSize: 15, color: "var(--text)", fontWeight: 600, marginBottom: 4, textAlign: "center" }}>
        {existingPlanCount === 0 ? "Start your first development plan" : "Add another development plan"}
      </p>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20, textAlign: "center" }}>
        Name your target role — we&apos;ll pull in your CV from Gap Analysis and your Career Profile
        automatically, infer typical responsibilities, and generate real milestones.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 440, margin: "0 auto" }}>
        <input
          type="text"
          required
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value)}
          aria-label="Target role"
          placeholder="Target role, e.g. Senior Product Manager"
          style={inputStyle}
        />
        <textarea
          value={cvText}
          onChange={(e) => setCvText(e.target.value)}
          aria-label="Extra background (optional)"
          placeholder="Optional — add anything not already in your CV or Career Profile"
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
            Plan duration
          </label>
          <select
            value={isFree ? "30-day" : horizon}
            onChange={(e) => setHorizon(e.target.value as typeof horizon)}
            disabled={isFree}
            style={{ ...inputStyle, cursor: isFree ? "not-allowed" : "pointer", opacity: isFree ? 0.7 : 1 }}
          >
            {HORIZON_OPTIONS.map((h) => (
              <option key={h.value} value={h.value} disabled={isFree && h.value !== "30-day"}>
                {h.label}
              </option>
            ))}
          </select>
          {isFree && (
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
              Free plans are 30 days with general guidance. Upgrade for longer horizons and specific
              course/resource recommendations.
            </p>
          )}
        </div>

        {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          style={{
            background: "var(--teal)",
            color: "#0A0F1E",
            border: "none",
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? "Generating your plan…" : "Generate my plan"}
        </button>
      </div>
    </form>
  );
}
