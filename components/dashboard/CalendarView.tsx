"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleTask } from "@/lib/tasks/actions";
import type { PersonalTask } from "@/lib/tasks/types";
import type { WeekDeadline } from "@/lib/tasks/actions";

type Mode = "week" | "month" | "year";

const PRIORITY_DOT: Record<PersonalTask["priority"], string> = {
  high: "#f87171",
  medium: "#f0b840",
  low: "var(--text-muted)",
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Plain string math, not a locale-sensitive Intl call — always renders in
// English regardless of the browser/OS locale.
function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

// Timed tasks sort chronologically first; untimed tasks keep their original
// (creation) order after them, rather than being scattered by string-sorting
// null against real times.
function sortByTime(tasks: PersonalTask[]): PersonalTask[] {
  return [...tasks].sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return 0;
  });
}

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as the first day
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

const modeButtonStyle = (active: boolean): React.CSSProperties => ({
  background: active ? "var(--teal)" : "transparent",
  color: active ? "#0A0F1E" : "var(--text-muted)",
  border: active ? "none" : "1px solid var(--border)",
  borderRadius: 100,
  padding: "5px 14px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
});

const navButtonStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--border)",
  borderRadius: 6,
  width: 28,
  height: 28,
  color: "var(--text-muted)",
  cursor: "pointer",
  fontSize: 13,
};

// One data fetch (a wide date range from the parent server component) sliced
// three ways client-side — switching Week/Month/Year or navigating prev/next
// is instant, no server round trip, as long as you stay inside the fetched
// window. Navigating past that window is a known v1 limit, not a bug.
export default function CalendarView({
  tasks,
  deadlines,
  onDayClick,
}: {
  tasks: PersonalTask[];
  deadlines: WeekDeadline[];
  onDayClick?: (dateStr: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("week");
  const [offset, setOffset] = useState(0);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const todayStr = toDateStr(today);

  function handleToggle(taskId: string, completed: boolean) {
    startTransition(async () => {
      await toggleTask(taskId, completed);
      router.refresh();
    });
  }

  function changeMode(next: Mode) {
    setMode(next);
    setOffset(0);
  }

  const week = useMemo(() => {
    const base = startOfWeek(today);
    base.setDate(base.getDate() + offset * 7);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      return toDateStr(d);
    });
    return { days, label: `${days[0]} – ${days[6]}` };
  }, [today, offset]);

  const month = useMemo(() => {
    const base = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const year = base.getFullYear();
    const m = base.getMonth();
    const firstDay = new Date(year, m, 1);
    const lastDay = new Date(year, m + 1, 0);
    const leading = (firstDay.getDay() + 6) % 7; // Monday-first offset
    const cells: (string | null)[] = Array(leading).fill(null);
    for (let d = 1; d <= lastDay.getDate(); d++) cells.push(toDateStr(new Date(year, m, d)));
    return { label: `${firstDay.toLocaleString("default", { month: "long" })} ${year}`, cells };
  }, [today, offset]);

  const year = useMemo(() => {
    const y = today.getFullYear() + offset;
    const months = Array.from({ length: 12 }, (_, m) => {
      const start = toDateStr(new Date(y, m, 1));
      const end = toDateStr(new Date(y, m + 1, 0));
      const monthDeadlines = deadlines.filter((d) => d.date >= start && d.date <= end);
      const monthTasks = tasks.filter((t) => t.date >= start && t.date <= end);
      return { label: MONTH_LABELS[m], deadlines: monthDeadlines, total: monthTasks.length, completed: monthTasks.filter((t) => t.completed).length };
    });
    return { year: y, months };
  }, [today, offset, tasks, deadlines]);

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Calendar</h2>
        <div style={{ display: "flex", gap: 6 }}>
          {(["week", "month", "year"] as Mode[]).map((m) => (
            <button key={m} type="button" onClick={() => changeMode(m)} style={modeButtonStyle(mode === m)}>
              {m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button type="button" onClick={() => setOffset((o) => o - 1)} style={navButtonStyle} aria-label="Previous">
          ←
        </button>
        <span style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 140 }}>
          {mode === "week" ? week.label : mode === "month" ? month.label : year.year}
        </span>
        <button type="button" onClick={() => setOffset((o) => o + 1)} style={navButtonStyle} aria-label="Next">
          →
        </button>
        {offset !== 0 && (
          <button type="button" onClick={() => setOffset(0)} style={{ ...navButtonStyle, width: "auto", padding: "0 10px" }}>
            Today
          </button>
        )}
      </div>

      {mode === "week" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
          {week.days.map((day, i) => {
            const dayTasks = sortByTime(tasks.filter((t) => t.date === day));
            const dayDeadlines = deadlines.filter((d) => d.date === day);
            const isToday = day === todayStr;
            return (
              <div
                key={day}
                onClick={() => onDayClick?.(day)}
                role={onDayClick ? "button" : undefined}
                tabIndex={onDayClick ? 0 : undefined}
                style={{
                  border: isToday ? "1px solid rgba(0,201,167,0.4)" : "1px solid var(--border)",
                  background: isToday ? "rgba(0,201,167,0.05)" : "rgba(255,255,255,0.02)",
                  borderRadius: 10,
                  padding: 10,
                  minHeight: 90,
                  cursor: onDayClick ? "pointer" : "default",
                }}
              >
                <p style={{ fontSize: 11, fontWeight: 700, color: isToday ? "var(--teal)" : "var(--text-muted)", marginBottom: 6 }}>
                  {DAY_LABELS[i]} {day.slice(8, 10)}
                </p>
                {dayDeadlines.map((d) => (
                  <p key={d.milestoneId} title={d.title} style={{ fontSize: 10.5, color: "#f0b840", fontWeight: 700, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    🏁 {d.title}
                  </p>
                ))}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {dayTasks.map((t) => (
                    <label
                      key={t.id}
                      onClick={(e) => e.stopPropagation()}
                      style={{ display: "flex", alignItems: "flex-start", gap: 5, cursor: "pointer" }}
                    >
                      <input type="checkbox" checked={t.completed} disabled={isPending} onChange={() => handleToggle(t.id, !t.completed)} style={{ marginTop: 2, accentColor: "var(--teal)", cursor: "pointer", flexShrink: 0 }} />
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: PRIORITY_DOT[t.priority], marginTop: 5, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: t.completed ? "var(--text-muted)" : "var(--text)", textDecoration: t.completed ? "line-through" : "none", lineHeight: 1.3 }}>
                        {t.time && <span style={{ color: "var(--text-muted)" }}>{formatTime(t.time)} · </span>}
                        {t.icon ? `${t.icon} ` : ""}
                        {t.title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mode === "month" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
            {DAY_LABELS.map((d) => (
              <p key={d} style={{ fontSize: 10.5, color: "var(--text-muted)", textAlign: "center" }}>
                {d}
              </p>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {month.cells.map((day, i) => {
              if (!day) return <div key={`blank-${i}`} />;
              const dayTasks = tasks.filter((t) => t.date === day);
              const dayDeadlines = deadlines.filter((d) => d.date === day);
              const isToday = day === todayStr;
              const doneCount = dayTasks.filter((t) => t.completed).length;
              return (
                <div
                  key={day}
                  onClick={() => onDayClick?.(day)}
                  role={onDayClick ? "button" : undefined}
                  tabIndex={onDayClick ? 0 : undefined}
                  title={[...dayDeadlines.map((d) => `🏁 ${d.title}`), ...dayTasks.map((t) => t.title)].join("\n") || undefined}
                  style={{
                    border: isToday ? "1px solid rgba(0,201,167,0.4)" : "1px solid var(--border)",
                    background: isToday ? "rgba(0,201,167,0.05)" : "rgba(255,255,255,0.02)",
                    borderRadius: 8,
                    padding: 6,
                    minHeight: 56,
                    cursor: onDayClick ? "pointer" : "default",
                  }}
                >
                  <p style={{ fontSize: 10.5, color: isToday ? "var(--teal)" : "var(--text-muted)", fontWeight: 700 }}>{day.slice(8, 10)}</p>
                  {dayDeadlines.length > 0 && <p style={{ fontSize: 12, lineHeight: 1 }}>🏁</p>}
                  {dayTasks.length > 0 && (
                    <p style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {doneCount}/{dayTasks.length}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mode === "year" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {year.months.map((m) => (
            <div key={m.label} style={{ border: "1px solid var(--border)", background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{m.label}</p>
              {m.deadlines.length === 0 ? (
                <p style={{ fontSize: 10.5, color: "var(--text-muted)" }}>No deadlines</p>
              ) : (
                m.deadlines.map((d) => (
                  <p key={d.milestoneId} title={d.title} style={{ fontSize: 10.5, color: "#f0b840", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    🏁 {d.title}
                  </p>
                ))
              )}
              {m.total > 0 && (
                <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6 }}>
                  {m.completed}/{m.total} tasks done
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
