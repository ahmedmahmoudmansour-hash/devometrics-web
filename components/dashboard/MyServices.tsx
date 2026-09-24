"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import MyLeaveManager from "@/components/dashboard/MyLeaveManager";
import HrLetterRequestSection from "@/components/dashboard/HrLetterRequestSection";
import MyAttendanceSection from "@/components/dashboard/MyAttendanceSection";
import type { AttendanceRecord } from "@/lib/attendance/actions";
import type { LeaveType, LeaveBalance, LeaveRequest } from "@/lib/leave/actions";
import type { HrLetterRequest } from "@/lib/hrLetters/actions";

// Two unrelated employee self-service items (time off, HR letters) used to
// sit stacked as four separate cards on one page — the exact "too crowded"
// complaint that also drove the admin Compensation/Leave dashboards to a
// tabbed layout earlier this session. Same fix here, and it's also why
// this destination is labeled "Services" in the sidebar now, not "Leave"
// (see SidebarNav.tsx) — it was never just leave/vacation.
export default function MyServices({
  organizationId,
  leaveTypes,
  balances,
  initialLeaveRequests,
  initialHrLetterRequests,
  initialAttendance,
}: {
  organizationId: string;
  leaveTypes: LeaveType[];
  balances: LeaveBalance[];
  initialLeaveRequests: LeaveRequest[];
  initialHrLetterRequests: HrLetterRequest[];
  initialAttendance: AttendanceRecord[];
}) {
  const t = useTranslations("myServicesPage");
  const [activeTab, setActiveTab] = useState<"timeOff" | "attendance" | "hrLetters">("timeOff");

  const pendingLetters = initialHrLetterRequests.filter((r) => r.status === "pending").length;

  const tabButtonStyle = (tab: string): React.CSSProperties => ({
    padding: "10px 18px",
    fontSize: 13,
    fontWeight: 700,
    background: "none",
    border: "none",
    borderBottom: activeTab === tab ? "2px solid var(--teal)" : "2px solid transparent",
    color: activeTab === tab ? "var(--teal)" : "var(--text-muted)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
  });
  const countPillStyle: React.CSSProperties = {
    background: "var(--teal)",
    color: "#0A0F1E",
    borderRadius: 999,
    padding: "1px 7px",
    fontSize: 11,
    fontWeight: 800,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)" }}>
        <button type="button" onClick={() => setActiveTab("timeOff")} style={tabButtonStyle("timeOff")}>
          {t("tabTimeOff")}
        </button>
        <button type="button" onClick={() => setActiveTab("attendance")} style={tabButtonStyle("attendance")}>
          {t("tabAttendance")}
        </button>
        <button type="button" onClick={() => setActiveTab("hrLetters")} style={tabButtonStyle("hrLetters")}>
          {t("tabHrLetters")}
          {pendingLetters > 0 && <span style={countPillStyle}>{pendingLetters}</span>}
        </button>
      </div>

      {activeTab === "timeOff" && (
        <MyLeaveManager organizationId={organizationId} leaveTypes={leaveTypes} balances={balances} initialRequests={initialLeaveRequests} />
      )}
      {activeTab === "attendance" && <MyAttendanceSection initialRecords={initialAttendance} />}
      {activeTab === "hrLetters" && <HrLetterRequestSection organizationId={organizationId} initialRequests={initialHrLetterRequests} />}
    </div>
  );
}
