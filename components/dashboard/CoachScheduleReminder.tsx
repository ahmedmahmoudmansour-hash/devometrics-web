"use client";

import { useMemo, useState } from "react";

// Defaults to tomorrow at 9am in whatever timezone the browser is actually
// in — good enough as a starting point without needing a location prompt;
// the user can change either field before downloading.
function defaultDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function CoachScheduleReminder() {
  const [frequency, setFrequency] = useState<"WEEKLY" | "BIWEEKLY" | "MONTHLY">("WEEKLY");
  const [date, setDate] = useState(defaultDate());
  const [time, setTime] = useState("09:00");
  const [sessions, setSessions] = useState("8");

  const timezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return null;
    }
  }, []);

  // Constructing via the (year, month, day, hour, minute) Date overload —
  // not the ISO-string constructor — is what makes the browser treat this
  // as local time in whatever zone it's actually running in, so "9am" means
  // 9am for the person clicking the button, not 9am UTC.
  const startAtISO = useMemo(() => {
    const [y, m, d] = date.split("-").map(Number);
    const [h, min] = time.split(":").map(Number);
    if (!y || !m || !d || Number.isNaN(h) || Number.isNaN(min)) return null;
    return new Date(y, m - 1, d, h, min).toISOString();
  }, [date, time]);

  const sessionsNum = Number(sessions);
  const href = startAtISO
    ? `/api/calendar/coach-checkin?frequency=${frequency}&start=${encodeURIComponent(startAtISO)}${
        sessionsNum > 0 ? `&sessions=${sessionsNum}` : ""
      }`
    : undefined;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        background: "var(--navy-mid)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "14px 20px",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 11, color: "var(--text-muted)" }}>
        <span style={{ color: "var(--teal)", fontWeight: 700 }}>1. Talk it through</span>
        <span>→</span>
        <span style={{ color: "var(--teal)", fontWeight: 700 }}>2. Agree an action plan</span>
        <span>→</span>
        <span style={{ color: "var(--teal)", fontWeight: 700 }}>3. Get reminded to follow through</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Get recurring check-in reminders:</span>
        <input
          type="date"
          lang="en-US"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="First reminder date"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 12,
            color: "var(--text)",
            outline: "none",
            colorScheme: "dark",
          }}
        />
        <input
          type="time"
          lang="en-US"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          aria-label="First reminder time"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 12,
            color: "var(--text)",
            outline: "none",
            colorScheme: "dark",
          }}
        />
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as "WEEKLY" | "BIWEEKLY" | "MONTHLY")}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 12,
            color: "var(--text)",
            outline: "none",
            cursor: "pointer",
          }}
        >
          <option value="WEEKLY">Weekly</option>
          <option value="BIWEEKLY">Every 2 weeks</option>
          <option value="MONTHLY">Monthly</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
          for
          <input
            type="number"
            min={1}
            max={52}
            value={sessions}
            onChange={(e) => setSessions(e.target.value)}
            aria-label="Number of sessions"
            style={{
              width: 48,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              padding: "6px 8px",
              fontSize: 12,
              color: "var(--text)",
              outline: "none",
            }}
          />
          sessions
        </label>
        <a
          href={href}
          style={{
            background: "rgba(0,201,167,0.1)",
            border: "1px solid rgba(0,201,167,0.3)",
            borderRadius: 6,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--teal)",
            textDecoration: "none",
            pointerEvents: href ? "auto" : "none",
            opacity: href ? 1 : 0.5,
          }}
        >
          Add to calendar
        </a>
      </div>
      {timezone && (
        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Time shown in your detected timezone ({timezone}) — the downloaded event adjusts automatically for
          whoever&apos;s calendar it lands in.
        </p>
      )}
    </div>
  );
}
