import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildTaskICS, type TaskRecurringFreq } from "@/lib/calendar/ics";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // RLS already scopes this to the caller's own tasks, but the explicit
  // .eq("user_id", ...) makes the intent obvious without relying on someone
  // reading the RLS policy to know that.
  const { data: task } = await supabase
    .from("personal_tasks")
    .select("id, title, recurring")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; title: string; recurring: string }>();
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const startParam = searchParams.get("start");
  const startAt = startParam && !Number.isNaN(Date.parse(startParam)) ? new Date(startParam) : new Date();

  const recurringMap: Record<string, TaskRecurringFreq | undefined> = {
    none: undefined,
    daily: "DAILY",
    weekdays: "DAILY",
    weekly: "WEEKLY",
    monthly: "MONTHLY",
  };

  const ics = buildTaskICS({
    uid: `task-${task.id}`,
    title: task.title,
    startAt,
    recurring: recurringMap[task.recurring],
    weekdaysOnly: task.recurring === "weekdays",
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="task.ics"`,
    },
  });
}
