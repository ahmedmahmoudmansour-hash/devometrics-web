"use client";

import { useTranslations } from "next-intl";

// Presentational only — data comes from getCustomStepCompletion, fetched by
// the owning CustomStepResponseForm so this can be reused without a second
// network round trip.
export default function CustomStepCompletionBadge({
  assignedCount,
  submittedCount,
  minRequired,
}: {
  assignedCount: number;
  submittedCount: number;
  minRequired: number | null;
}) {
  const t = useTranslations("customStepCompletionBadge");
  const target = minRequired ?? assignedCount;
  const done = target > 0 && submittedCount >= target;

  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        padding: "3px 8px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        background: done ? "rgba(0,201,167,0.12)" : "rgba(255,255,255,0.06)",
        border: `1px solid ${done ? "rgba(0,201,167,0.3)" : "var(--border)"}`,
        color: done ? "var(--teal)" : "var(--text-muted)",
      }}
    >
      {target > 0 ? t("progress", { submitted: submittedCount, total: target }) : t("noneAssigned")}
    </span>
  );
}
