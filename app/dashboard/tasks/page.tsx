import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listTodayTasks, listCalendarRange } from "@/lib/tasks/actions";
import TasksPageClient from "@/components/dashboard/TasksPageClient";
import type { Milestone } from "@/lib/supabase/types";

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function TasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tasks = await listTodayTasks();

  // One wide window (2 months back, 10 months forward) covers Week/Month/Year
  // navigation client-side without a server round trip per mode switch —
  // going further back/forward than this window is a known v1 limit.
  const now = new Date();
  const rangeStart = toDateStr(new Date(now.getFullYear(), now.getMonth() - 2, 1));
  const rangeEnd = toDateStr(new Date(now.getFullYear(), now.getMonth() + 10, 0));
  const calendar = await listCalendarRange(rangeStart, rangeEnd);

  const { data: plans } = await supabase.from("development_plans").select("id").eq("user_id", user.id);
  const planIds = (plans ?? []).map((p) => p.id);
  const { data: openMilestones } = planIds.length
    ? await supabase
        .from("milestones")
        .select("*")
        .in("plan_id", planIds)
        .eq("completed", false)
        .order("position", { ascending: true })
        .returns<Milestone[]>()
    : { data: [] as Milestone[] };

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to progress
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            Today&apos;s tasks
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Your own working list — private, never visible to your manager or organization.
          </p>
        </div>

        <TasksPageClient
          tasks={tasks}
          milestones={openMilestones ?? []}
          calendarTasks={calendar.tasks}
          calendarDeadlines={calendar.deadlines}
        />
      </div>
    </div>
  );
}
