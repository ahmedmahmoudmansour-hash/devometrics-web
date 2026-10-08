"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { addPublicHoliday, removePublicHoliday, setWeekendDays } from "@/lib/leave/calendarSettings";
import { ISO_WEEKDAYS, type LeaveCalendar, type PublicHoliday } from "@/lib/leave/calendar";

const cardStyle: React.CSSProperties = { background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 };
const fieldStyle: React.CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 14px", fontSize: 14, color: "var(--text)", outline: "none" };

// The company's weekend days and public holidays (0194). Leave requests are
// counted in working days from this: weekends and holidays inside a request
// aren't deducted from anyone's balance.
export default function LeaveCalendarSettings({ organizationId, initialCalendar }: { organizationId: string; initialCalendar: LeaveCalendar }) {
  const t = useTranslations("leaveCalendarSettings");
  const [isPending, startTransition] = useTransition();
  const [weekend, setWeekend] = useState<number[]>(initialCalendar.weekendDays);
  const [holidays, setHolidays] = useState<PublicHoliday[]>(initialCalendar.holidays);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function toggleDay(day: number, on: boolean) {
    const previous = weekend;
    const next = on ? [...weekend, day] : weekend.filter((d) => d !== day);
    if (next.length > 6) return setError(t("needWorkingDay"));
    setWeekend(next);
    setError(null);
    startTransition(async () => {
      const result = await setWeekendDays(organizationId, next);
      if ("error" in result) {
        setWeekend(previous);
        setError(result.error);
      }
    });
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return setError(t("dateError"));
    if (!name.trim()) return setError(t("nameError"));
    setError(null);
    startTransition(async () => {
      const result = await addPublicHoliday(organizationId, date, name);
      if ("error" in result) return setError(result.error);
      setHolidays((prev) => [...prev, { id: result.id, date, name: name.trim() }].sort((a, b) => a.date.localeCompare(b.date)));
      setDate("");
      setName("");
    });
  }

  function handleRemove(id: string) {
    const previous = holidays;
    setHolidays((prev) => prev.filter((h) => h.id !== id));
    setError(null);
    startTransition(async () => {
      const result = await removePublicHoliday(id);
      if ("error" in result) {
        setHolidays(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div style={cardStyle}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("title")}</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6, maxWidth: 560 }}>{t("description")}</p>

      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>{t("weekendLabel")}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 22 }}>
        {ISO_WEEKDAYS.map((day) => (
          <label key={day} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "var(--text)", cursor: "pointer" }}>
            <input type="checkbox" checked={weekend.includes(day)} disabled={isPending} onChange={(e) => toggleDay(day, e.target.checked)} />
            {t(`day_${day}`)}
          </label>
        ))}
      </div>

      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>{t("holidaysLabel")}</p>
      {holidays.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>{t("noHolidays")}</p>
      ) : (
        <div style={{ marginBottom: 14 }}>
          {holidays.map((h) => (
            <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 0", borderTop: "1px solid var(--border)", fontSize: 13.5 }}>
              <span style={{ color: "var(--text)" }}>
                <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-muted)", marginInlineEnd: 10 }}>{h.date}</span>
                {h.name}
              </span>
              <button type="button" disabled={isPending} onClick={() => handleRemove(h.id)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>
                {t("remove")}
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...fieldStyle, flex: "0 1 170px" }} aria-label={t("dateLabel")} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} style={{ ...fieldStyle, flex: "1 1 200px" }} />
        <button
          type="submit"
          disabled={isPending}
          style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
        >
          {t("addButton")}
        </button>
      </form>
      {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{error}</p>}
    </div>
  );
}
