import Link from "next/link";
import type { PersonalTask } from "@/lib/tasks/types";

// Shows today's progress AND anything incomplete left over from previous
// days — an overdue task that silently vanished from view was the main way
// the task list lied to people.
export default function TodayTasksCard({
  tasks,
  overdue = [],
}: {
  tasks: PersonalTask[];
  overdue?: PersonalTask[];
}) {
  if (tasks.length === 0 && overdue.length === 0) return null;

  const done = tasks.filter((t) => t.completed).length;
  const pendingToday = tasks.filter((t) => !t.completed);

  return (
    <Link
      href="/dashboard/tasks"
      style={{
        display: "block",
        background: "var(--navy-mid)",
        border: overdue.length > 0 ? "1px solid rgba(240,184,64,0.35)" : "1px solid var(--border)",
        borderRadius: 16,
        padding: 20,
        textDecoration: "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Your tasks</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {tasks.length > 0
              ? `${done} of ${tasks.length} done today`
              : overdue.length > 0
              ? `Nothing new today, but ${overdue.length} overdue`
              : "Nothing scheduled today"}
            {" — private to you, never visible to anyone else"}
          </p>
        </div>
        {tasks.length > 0 && (
          <span style={{ fontSize: 20, fontWeight: 800, color: "var(--teal)" }}>
            {done}/{tasks.length}
          </span>
        )}
      </div>

      {pendingToday.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
          {pendingToday.slice(0, 3).map((t) => (
            <p key={t.id} style={{ fontSize: 12.5, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              ○ {t.icon ? `${t.icon} ` : ""}{t.title}
            </p>
          ))}
          {pendingToday.length > 3 && (
            <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>+ {pendingToday.length - 3} more</p>
          )}
        </div>
      )}

      {overdue.length > 0 && (
        <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--amber)", marginBottom: 4 }}>
            Overdue ({overdue.length})
          </p>
          {overdue.slice(0, 3).map((t) => (
            <p key={t.id} style={{ fontSize: 12.5, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              ○ {t.title} <span style={{ fontSize: 11 }}>· {t.date}</span>
            </p>
          ))}
          {overdue.length > 3 && (
            <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>+ {overdue.length - 3} more</p>
          )}
        </div>
      )}
    </Link>
  );
}
