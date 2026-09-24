"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { checkIn, checkOut, type AttendanceRecord } from "@/lib/attendance/actions";

const cardStyle: React.CSSProperties = { background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 };
const btnPrimary: React.CSSProperties = { background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "14px 24px", fontSize: 16, fontWeight: 700, cursor: "pointer" };

const pad = (n: number) => String(n).padStart(2, "0");
function localNow() {
  const d = new Date();
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

// The employee's own attendance: a one-tap clock in / out for today, and
// this month's days. The date and time come from the device (no GPS or
// hardware check); the database refuses anything more than a day from today.
export default function MyAttendanceSection({ initialRecords }: { initialRecords: AttendanceRecord[] }) {
  const t = useTranslations("myAttendance");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [records, setRecords] = useState(initialRecords);
  const [error, setError] = useState<string | null>(null);
  const [today] = useState(() => localNow().date);
  // Ticks every 20s so the clock never looks stale; only the display, the
  // recorded time is always read fresh at the moment of the click.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(id);
  }, []);

  const todayRecord = records.find((r) => r.workDate === today);

  function apply(kind: "in" | "out") {
    setError(null);
    const { date, time } = localNow();
    startTransition(async () => {
      const result = kind === "in" ? await checkIn(date, time) : await checkOut(date, time);
      if ("error" in result) return setError(result.error);
      setRecords((prev) => {
        const existing = prev.find((r) => r.workDate === date);
        if (existing) return prev.map((r) => (r.workDate === date ? { ...r, ...(kind === "in" ? { checkIn: r.checkIn ?? time } : { checkOut: time }) } : r));
        return [{ id: `local-${date}`, userId: "", workDate: date, status: "present", checkIn: time, checkOut: null, source: "self", notes: null }, ...prev];
      });
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: "0 0 4px" }}>{t("todayTitle")}</h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>{now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
          <span style={{ fontSize: 34, fontWeight: 800, color: "var(--text)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
          </span>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 14px", lineHeight: 1.6 }}>{t("todayHint")}</p>
        {!todayRecord?.checkIn ? (
          <button type="button" disabled={isPending} onClick={() => apply("in")} style={{ ...btnPrimary, width: "100%", maxWidth: 320, opacity: isPending ? 0.6 : 1 }}>
            {t("checkIn")}
          </button>
        ) : !todayRecord.checkOut ? (
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, color: "var(--text)" }}>{t("checkedInAt", { time: todayRecord.checkIn })}</span>
            <button type="button" disabled={isPending} onClick={() => apply("out")} style={{ ...btnPrimary, width: "100%", maxWidth: 320, opacity: isPending ? 0.6 : 1 }}>
              {t("checkOut")}
            </button>
          </div>
        ) : (
          <p style={{ fontSize: 14, color: "var(--teal)", margin: 0 }}>{t("doneToday", { from: todayRecord.checkIn, to: todayRecord.checkOut })}</p>
        )}
        {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{error}</p>}
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: "0 0 12px" }}>{t("monthTitle")}</h2>
        {records.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{t("noRecords")}</p>
        ) : (
          <div>
            {records.map((r) => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
                <span style={{ color: "var(--text)" }}>
                  {r.workDate} <span style={{ color: "var(--text-muted)" }}>— {t(`status_${r.status}`)}</span>
                </span>
                <span style={{ color: "var(--text-muted)" }}>
                  {r.checkIn ?? "—"} → {r.checkOut ?? "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
