"use client";

import { useTranslations } from "next-intl";
import EmploymentHistoryTimeline from "@/components/dashboard/EmploymentHistoryTimeline";
import type { EmploymentHistoryEvent } from "@/lib/employmentHistory/actions";

// One outer card, one collapsed row per direct report — not one card per
// person (that was the "TeamLeaveOverview vs. five stacked cards"
// mistake to avoid). Empty entirely when the org's employment_history_
// manager_visibility is 'hidden': list_employee_history() (0170) then
// returns [] for every report, so this whole section renders nothing,
// same "return null on empty" convention as TeamCompensationSection/
// TeamLeaveOverview.
export default function TeamEmploymentHistory({
  eventsByEmployee,
  employeeNames,
}: {
  eventsByEmployee: Record<string, EmploymentHistoryEvent[]>;
  employeeNames: Record<string, { name: string; email: string }>;
}) {
  const t = useTranslations("teamEmploymentHistory");
  const employeeIds = Object.keys(eventsByEmployee).filter((id) => eventsByEmployee[id].length > 0);
  if (employeeIds.length === 0) return null;

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("title")}</h2>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>{t("description")}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {employeeIds.map((employeeUserId) => (
          <div key={employeeUserId} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{employeeNames[employeeUserId]?.name ?? t("unknownEmployee")}</span>
            <EmploymentHistoryTimeline events={eventsByEmployee[employeeUserId]} collapsible variant="bare" />
          </div>
        ))}
      </div>
    </div>
  );
}
