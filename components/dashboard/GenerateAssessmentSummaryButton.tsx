"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateEmployeeAssessmentSummary } from "@/lib/organizations/actions";

export default function GenerateAssessmentSummaryButton({
  employeeUserId,
  hasSummary,
  pendingAssignments,
}: {
  employeeUserId: string;
  hasSummary: boolean;
  // Names of assessments you assigned this person that aren't completed
  // yet — generating a summary against a partial picture would read as
  // finished when it isn't, so the button waits for these rather than
  // just warning after the fact.
  pendingAssignments: string[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const blocked = pendingAssignments.length > 0;

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await generateEmployeeAssessmentSummary(employeeUserId);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={generate}
        disabled={isPending || blocked}
        style={{
          background: "rgba(0,201,167,0.1)",
          border: "1px solid rgba(0,201,167,0.3)",
          borderRadius: 8,
          padding: "9px 16px",
          fontSize: 13,
          fontWeight: 700,
          color: "var(--teal)",
          cursor: blocked ? "not-allowed" : "pointer",
          opacity: isPending || blocked ? 0.5 : 1,
        }}
      >
        {isPending ? "Writing…" : hasSummary ? "↻ Regenerate professional summary" : "▶ Generate professional summary"}
      </button>
      {blocked && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
          Waiting on {pendingAssignments.length} assigned assessment{pendingAssignments.length === 1 ? "" : "s"} —{" "}
          {pendingAssignments.join(", ")}. The summary won&apos;t be accurate until these are complete.
        </p>
      )}
      {error && <p style={{ color: "#f87171", fontSize: 12.5, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
