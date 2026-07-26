import Link from "next/link";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("todayTasksCard");
  if (tasks.length === 0 && overdue.length === 0) return null;

  const done = tasks.filter((task) => task.completed).length;
  const pendingToday = tasks.filter((task) => !task.completed);

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
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{t("title")}</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {tasks.length > 0
              ? t("doneToday", { done, total: tasks.length })
              : overdue.length > 0
              ? t("overdueOnly", { count: overdue.length })
              : t("nothingScheduled")}
            {" "}{t("privateSuffix")}
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
          {pendingToday.slice(0, 3).map((task) => (
            <p key={task.id} style={{ fontSize: 12.5, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              ○ {task.icon ? `${task.icon} ` : ""}{task.title}
            </p>
          ))}
          {pendingToday.length > 3 && (
            <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t("moreCount", { count: pendingToday.length - 3 })}</p>
          )}
        </div>
      )}

      {overdue.length > 0 && (
        <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--amber)", marginBottom: 4 }}>
            {t("overdueLabel", { count: overdue.length })}
          </p>
          {overdue.slice(0, 3).map((task) => (
            <p key={task.id} style={{ fontSize: 12.5, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              ○ {task.title} <span style={{ fontSize: 11 }}>· {task.date}</span>
            </p>
          ))}
          {overdue.length > 3 && (
            <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t("moreCount", { count: overdue.length - 3 })}</p>
          )}
        </div>
      )}
    </Link>
  );
}
