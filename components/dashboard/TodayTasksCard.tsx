import Link from "next/link";
import type { PersonalTask } from "@/lib/tasks/types";

export default function TodayTasksCard({ tasks }: { tasks: PersonalTask[] }) {
  if (tasks.length === 0) return null;

  const done = tasks.filter((t) => t.completed).length;

  return (
    <Link
      href="/dashboard/tasks"
      style={{
        display: "block",
        background: "var(--navy-mid)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 20,
        textDecoration: "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Today&apos;s tasks</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {done} of {tasks.length} done — private to you, never visible to anyone else
          </p>
        </div>
        <span style={{ fontSize: 20, fontWeight: 800, color: "var(--teal)" }}>
          {done}/{tasks.length}
        </span>
      </div>
    </Link>
  );
}
