"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setEmploymentHistoryManagerVisibility, type EmploymentHistoryManagerVisibility } from "@/lib/employmentHistory/actions";

// Lives on the general Company Settings page rather than under Leave or
// Compensation — title/role-change history isn't either feature's data,
// it's cross-cutting employee-lifecycle data, so it gets its own small
// toggle instead of being awkwardly filed under an unrelated tab. Note
// the band-change slice of the timeline is governed separately by
// compensation's own manager_compensation_visibility (0170's header) —
// this setting only affects title/role changes and the join date.
export default function EmploymentHistoryVisibilityForm({
  organizationId,
  initial,
}: {
  organizationId: string;
  initial: EmploymentHistoryManagerVisibility;
}) {
  const t = useTranslations("employmentHistoryVisibilityForm");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [visibility, setVisibility] = useState(initial);

  function handleChange(next: EmploymentHistoryManagerVisibility) {
    setVisibility(next);
    startTransition(async () => {
      await setEmploymentHistoryManagerVisibility(organizationId, next);
      router.refresh();
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("title")}</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>{t("description")}</p>
      <select
        value={visibility}
        onChange={(e) => handleChange(e.target.value as EmploymentHistoryManagerVisibility)}
        disabled={isPending}
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8,
          padding: "10px 14px",
          fontSize: 14,
          color: "var(--text)",
          outline: "none",
          maxWidth: 300,
        }}
      >
        <option value="visible">{t("visible")}</option>
        <option value="hidden">{t("hidden")}</option>
      </select>
    </div>
  );
}
