"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { breakdownIntoSteps } from "./breakdown";
import type { PersonalTask, PersonalSubtask, TaskRecurring, TaskPriority } from "./types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

// Spawns today's copy of any recurring task that hasn't already been
// instantiated today — dedup by title, mirroring the client-side approach
// Orbit used, just persisted server-side against Supabase instead.
async function spawnRecurringTasks(supabase: SupabaseServerClient, userId: string) {
  const today = todayStr();
  const now = new Date();

  const { data: recurringTasks } = await supabase
    .from("personal_tasks")
    .select("*")
    .eq("user_id", userId)
    .neq("recurring", "none")
    .order("created_at", { ascending: false })
    .returns<PersonalTask[]>();
  if (!recurringTasks || recurringTasks.length === 0) return;

  const latestByTitle = new Map<string, PersonalTask>();
  for (const t of recurringTasks) {
    if (!latestByTitle.has(t.title)) latestByTitle.set(t.title, t);
  }

  const { data: todayTasks } = await supabase
    .from("personal_tasks")
    .select("title")
    .eq("user_id", userId)
    .eq("date", today)
    .returns<{ title: string }[]>();
  const todayTitles = new Set((todayTasks ?? []).map((t) => t.title));

  const toInsert: PersonalTask[] = [];
  for (const t of latestByTitle.values()) {
    if (todayTitles.has(t.title) || t.date === today) continue;
    if (t.recurring === "daily") {
      toInsert.push(t);
    } else if (t.recurring === "weekdays" && isWeekday(now)) {
      toInsert.push(t);
    } else if (t.recurring === "weekly" && new Date(t.date).getDay() === now.getDay()) {
      toInsert.push(t);
    } else if (t.recurring === "monthly" && new Date(t.date).getDate() === now.getDate()) {
      toInsert.push(t);
    }
  }

  if (toInsert.length > 0) {
    await supabase.from("personal_tasks").insert(
      toInsert.map((t) => ({
        user_id: userId,
        milestone_id: t.milestone_id,
        title: t.title,
        subtasks: t.subtasks.map((s) => ({ ...s, done: false })),
        recurring: t.recurring,
        time: t.time,
        date: today,
        completed: false,
      }))
    );
  }
}

export async function listTodayTasks(): Promise<PersonalTask[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  await spawnRecurringTasks(supabase, user.id);

  const { data } = await supabase
    .from("personal_tasks")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", todayStr())
    .order("created_at", { ascending: true })
    .returns<PersonalTask[]>();
  return data ?? [];
}

// One-off tasks left incomplete on a past date — surfaced on the home
// dashboard so they don't silently vanish from view. Recurring tasks are
// deliberately excluded: yesterday's un-ticked "daily review" instance is
// noise (today's instance exists), not a real overdue commitment.
export async function listOverdueTasks(): Promise<PersonalTask[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("personal_tasks")
    .select("*")
    .eq("user_id", user.id)
    .eq("completed", false)
    .eq("recurring", "none")
    .lt("date", todayStr())
    .order("date", { ascending: false })
    .limit(10)
    .returns<PersonalTask[]>();
  return data ?? [];
}

export type WeekDeadline = { milestoneId: string; title: string; date: string };

// Generic date-range fetch backing all three calendar granularities (week,
// month, year) — the client component slices/groups this same data rather
// than each mode making its own server round trip. Only returns tasks that
// already exist: recurring tasks for future days aren't fabricated here,
// since spawnRecurringTasks() only creates a day's instance when that day is
// actually visited (listTodayTasks). A future day showing empty just means
// it hasn't been visited yet, not that nothing is scheduled.
export async function listCalendarRange(
  startStr: string,
  endStr: string
): Promise<{ tasks: PersonalTask[]; deadlines: WeekDeadline[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { tasks: [], deadlines: [] };

  await spawnRecurringTasks(supabase, user.id);

  const { data: tasks } = await supabase
    .from("personal_tasks")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", startStr)
    .lte("date", endStr)
    .order("created_at", { ascending: true })
    .returns<PersonalTask[]>();

  const { data: plans } = await supabase.from("development_plans").select("id").eq("user_id", user.id);
  const planIds = (plans ?? []).map((p) => p.id);
  const { data: milestones } = planIds.length
    ? await supabase
        .from("milestones")
        .select("id, title, target_date, plan_id")
        .in("plan_id", planIds)
        .gte("target_date", startStr)
        .lte("target_date", endStr)
        .returns<{ id: string; title: string; target_date: string }[]>()
    : { data: [] as { id: string; title: string; target_date: string }[] };

  const deadlines: WeekDeadline[] = (milestones ?? []).map((m) => ({
    milestoneId: m.id,
    title: m.title,
    date: m.target_date,
  }));

  return { tasks: tasks ?? [], deadlines };
}

export async function createTask(fields: {
  title: string;
  recurring: TaskRecurring;
  milestoneId?: string | null;
  subtasks?: string[];
  priority?: TaskPriority;
  icon?: string | null;
  time?: string | null;
  date?: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const title = fields.title.trim();
  if (!title) return { error: "Give the task a title" };

  const subtasks: PersonalSubtask[] = (fields.subtasks ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text, i) => ({ id: `s_${Date.now()}_${i}`, text, done: false }));

  const { error } = await supabase.from("personal_tasks").insert({
    user_id: user.id,
    milestone_id: fields.milestoneId ?? null,
    title,
    subtasks,
    recurring: fields.recurring,
    priority: fields.priority ?? "medium",
    icon: fields.icon ?? null,
    time: fields.time?.trim() || null,
    date: fields.date?.trim() || todayStr(),
  });
  if (error) {
    console.error("createTask insert failed:", error);
    return { error: "Could not create task — try again." };
  }

  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateTaskMeta(id: string, fields: { priority?: TaskPriority; icon?: string | null; time?: string | null }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("personal_tasks").update(fields).eq("id", id).eq("user_id", user.id);
  if (error) return { error: "Could not update — try again." };

  revalidatePath("/dashboard/tasks");
  return { success: true };
}

export async function toggleTask(id: string, completed: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("personal_tasks")
    .update({ completed, completed_at: completed ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: "Could not update task — try again." };

  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateTaskNotes(id: string, notes: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("personal_tasks")
    .update({ notes: notes.trim() || null })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: "Could not save note — try again." };

  revalidatePath("/dashboard/tasks");
  return { success: true };
}

export async function toggleSubtask(taskId: string, subtaskId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: task } = await supabase
    .from("personal_tasks")
    .select("subtasks")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .maybeSingle<{ subtasks: PersonalSubtask[] }>();
  if (!task) return { error: "Task not found" };

  const subtasks = task.subtasks.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s));
  const { error } = await supabase.from("personal_tasks").update({ subtasks }).eq("id", taskId).eq("user_id", user.id);
  if (error) return { error: "Could not update — try again." };

  revalidatePath("/dashboard/tasks");
  return { success: true };
}

export async function deleteTask(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("personal_tasks").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: "Could not delete — try again." };

  revalidatePath("/dashboard/tasks");
  return { success: true };
}

// Turns one milestone into several concrete, dated tasks for today — the
// "compass → daily tool" bridge. Ownership is checked explicitly (not just
// relying on RLS visibility), since org admins can also see a member's
// milestone but must never be able to seed tasks into someone else's
// private task list.
export async function breakdownMilestoneIntoTasks(milestoneId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: milestone } = await supabase
    .from("milestones")
    .select("id, title, description, plan_id")
    .eq("id", milestoneId)
    .maybeSingle<{ id: string; title: string; description: string | null; plan_id: string }>();
  if (!milestone) return { error: "Milestone not found" };

  const { data: plan } = await supabase
    .from("development_plans")
    .select("user_id")
    .eq("id", milestone.plan_id)
    .maybeSingle<{ user_id: string }>();
  if (!plan || plan.user_id !== user.id) return { error: "You can only break down your own milestones" };

  let steps: string[];
  try {
    steps = await breakdownIntoSteps(milestone.title, milestone.description ?? undefined);
  } catch {
    return { error: "Could not generate steps right now — try again." };
  }

  const { error } = await supabase.from("personal_tasks").insert(
    steps.map((title) => ({
      user_id: user.id,
      milestone_id: milestone.id,
      title,
      subtasks: [],
      recurring: "none",
      date: todayStr(),
    }))
  );
  if (error) return { error: "Generated steps, but could not save them — try again." };

  revalidatePath("/dashboard/tasks");
  return { success: true, count: steps.length };
}

export async function breakdownTaskIntoSubtasks(taskId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: task } = await supabase
    .from("personal_tasks")
    .select("id, title")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; title: string }>();
  if (!task) return { error: "Task not found" };

  let steps: string[];
  try {
    steps = await breakdownIntoSteps(task.title);
  } catch {
    return { error: "Could not generate steps right now — try again." };
  }

  const subtasks: PersonalSubtask[] = steps.map((text, i) => ({ id: `s_${Date.now()}_${i}`, text, done: false }));
  const { error } = await supabase.from("personal_tasks").update({ subtasks }).eq("id", taskId).eq("user_id", user.id);
  if (error) return { error: "Generated steps, but could not save them — try again." };

  revalidatePath("/dashboard/tasks");
  return { success: true };
}
