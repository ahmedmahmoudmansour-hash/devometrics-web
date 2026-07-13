"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateEmployeeAssessmentSummary } from "@/lib/organizations/actions";

export default function GenerateAssessmentSummaryButton({
  employeeUserId,
  hasSummary,
}: {
  employeeUserId: string;
  hasSummary: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

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
        disabled={isPending}
        style={{
          background: "rgba(0,201,167,0.1)",
          border: "1px solid rgba(0,201,167,0.3)",
          borderRadius: 8,
          padding: "9px 16px",
          fontSize: 13,
          fontWeight: 700,
          color: "var(--teal)",
          cursor: "pointer",
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {isPending ? "Writing…" : hasSummary ? "↻ Regenerate professional summary" : "▶ Generate professional summary"}
      </button>
      {error && <p style={{ color: "#f87171", fontSize: 12.5, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
