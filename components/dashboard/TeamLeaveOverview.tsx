"use client";

// Read-only, no interactivity — "use client" only because useTranslations
// (the sync hook) needs it; no state, no transitions. The org's leave_
// manager_visibility setting (0169) is enforced entirely server-side by
// list_team_leave_overview: when 'hidden', the RPC returns an empty array
// and this whole section renders nothing, same "return null on empty"
// convention as TeamCompensationSection. This is the missing UI surface
// for that setting — without it, the admin toggle on the Leave Settings
// tab controlled a feature nothing ever displayed.
import { useTranslations } from "next-intl";
import type { LeaveBalance, LeaveType } from "@/lib/leave/actions";

export default function TeamLeaveOverview({
  balances,
  leaveTypes,
  employeeNames,
}: {
  balances: LeaveBalance[];
  leaveTypes: LeaveType[];
  employeeNames: Record<string, { name: string; email: string }>;
}) {
  const t = useTranslations("teamLeaveOverview");
  if (balances.length === 0) return null;

  const employeeIds = Array.from(new Set(balances.map((b) => b.employeeUserId)));

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("title")}</h2>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>{t("description")}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {employeeIds.map((employeeUserId) => {
          const rows = balances.filter((b) => b.employeeUserId === employeeUserId);
          return (
            <div key={employeeUserId} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{employeeNames[employeeUserId]?.name ?? t("unknownEmployee")}</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                {rows.map((b) => {
                  const lt = leaveTypes.find((type) => type.id === b.leaveTypeId);
                  const remaining = Math.max(0, b.allocatedDays - b.usedDays);
                  return (
                    <span
                      key={b.id}
                      style={{
                        fontSize: 12,
                        color: "var(--text)",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid var(--border)",
                        borderRadius: 999,
                        padding: "4px 10px",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {lt?.name ?? t("unknownType")}: <strong>{remaining}</strong> / {b.allocatedDays}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
