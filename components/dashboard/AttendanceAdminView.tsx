"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { deleteAttendanceRecord, type AttendanceRecord } from "@/lib/attendance/actions";

const cardStyle: React.CSSProperties = { background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 };
const th: React.CSSProperties = { padding: "8px 10px", textAlign: "start", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, color: "var(--text)" };
const btnGhost: React.CSSProperties = { background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" };

function minutesBetween(a: string, b: string): number {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return bh * 60 + bm - (ah * 60 + am);
}

// A month at a glance: one summary row per employee (days by status and
// hours worked where both times exist), then every record with a remove
// button for corrections.
export default function AttendanceAdminView({
  records: initial,
  employees,
}: {
  records: AttendanceRecord[];
  employees: { userId: string; name: string }[];
}) {
  const t = useTranslations("attendanceAdmin");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [records, setRecords] = useState(initial);
  const nameOf = new Map(employees.map((e) => [e.userId, e.name]));

  function handleRemove(id: string) {
    startTransition(async () => {
      const result = await deleteAttendanceRecord(id);
      if (!("error" in result)) {
        setRecords((prev) => prev.filter((r) => r.id !== id));
        router.refresh();
      }
    });
  }

  const summary = employees
    .map((e) => {
      const mine = records.filter((r) => r.userId === e.userId);
      const count = (s: string) => mine.filter((r) => r.status === s).length;
      const minutes = mine.reduce((sum, r) => (r.checkIn && r.checkOut ? sum + Math.max(0, minutesBetween(r.checkIn, r.checkOut)) : sum), 0);
      return { ...e, days: mine.length, present: count("present"), late: count("late"), remote: count("remote"), absent: count("absent"), hours: Math.round((minutes / 60) * 10) / 10 };
    })
    .filter((s) => s.days > 0);

  if (records.length === 0) {
    return (
      <div style={cardStyle}>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{t("empty")}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={cardStyle}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: "0 0 12px" }}>{t("summaryTitle")}</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>{t("colEmployee")}</th>
                <th style={th}>{t("colDays")}</th>
                <th style={th}>{t("status_present")}</th>
                <th style={th}>{t("status_late")}</th>
                <th style={th}>{t("status_remote")}</th>
                <th style={th}>{t("status_absent")}</th>
                <th style={th}>{t("colHours")}</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.userId} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={td}>{s.name}</td>
                  <td style={td}>{s.days}</td>
                  <td style={td}>{s.present}</td>
                  <td style={{ ...td, color: s.late ? "var(--amber)" : "var(--text)" }}>{s.late}</td>
                  <td style={td}>{s.remote}</td>
                  <td style={{ ...td, color: s.absent ? "var(--danger)" : "var(--text)" }}>{s.absent}</td>
                  <td style={td}>{s.hours || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: "0 0 12px" }}>{t("recordsTitle", { count: records.length })}</h2>
        <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>{t("colDate")}</th>
                <th style={th}>{t("colEmployee")}</th>
                <th style={th}>{t("colStatus")}</th>
                <th style={th}>{t("colIn")}</th>
                <th style={th}>{t("colOut")}</th>
                <th style={th}>{t("colSource")}</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{r.workDate}</td>
                  <td style={td}>{nameOf.get(r.userId) ?? "—"}</td>
                  <td style={td}>{t(`status_${r.status}`)}</td>
                  <td style={td}>{r.checkIn ?? "—"}</td>
                  <td style={td}>{r.checkOut ?? "—"}</td>
                  <td style={{ ...td, color: "var(--text-muted)" }}>{t(`source_${r.source}`)}</td>
                  <td style={td}>
                    <button type="button" disabled={isPending} onClick={() => handleRemove(r.id)} style={btnGhost}>
                      {t("remove")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
