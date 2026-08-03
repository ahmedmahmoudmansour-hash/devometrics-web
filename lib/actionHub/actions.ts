import { createClient } from "@/lib/supabase/server";
import { listTodayTasks, listOverdueTasks } from "@/lib/tasks/actions";
import { resolveAssignableName } from "@/lib/assessments/assignableCatalog";
import type { Milestone } from "@/lib/supabase/types";
import type { PendingAction } from "./types";

const MILESTONE_WINDOW_DAYS = 7;

// Unified "everything requiring your attention" list — consolidates what
// were previously 4 separate, unrelated surfaces (Tasks & Calendar,
// Assessments' "Assigned to you" callout, Knowledge Hub's due-date list,
// and Impact Cycle's self-assessment status) into one list, per the
// 2026-08-03 strategic memo's "Unified Employee Action Hub" item.
//
// Deliberately broader than the reminder-email cron's own due_*_reminders
// SQL functions: those are TIME-gated (only fire close to/past a due
// date, so a nightly email isn't sent for something assigned yesterday
// with no deadline pressure yet). This is the opposite framing — a
// persistent "here's everything still on your plate" list, so it
// includes every incomplete assigned item regardless of how recently it
// was assigned or whether it even has a due date at all.
export async function listMyPendingActions(): Promise<PendingAction[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [todayTasks, overdueTasks, assignedRows, kbRows, reviewRows] = await Promise.all([
    listTodayTasks(),
    listOverdueTasks(),
    supabase
      .from("assigned_assessments")
      .select("id, assessment_slug")
      .eq("employee_user_id", user.id)
      .returns<{ id: string; assessment_slug: string }[]>(),
    // Same self-select policy Knowledge Hub's own page already relies on
    // (migration 0084) — an employee reading their own assignment rows,
    // not the cron's SECURITY DEFINER path.
    supabase
      .from("knowledge_hub_assignments")
      .select("id, content_id, knowledge_hub_content(title, due_date, archived_at)")
      .eq("employee_user_id", user.id)
      .returns<{ id: string; content_id: string; knowledge_hub_content: { title: string; due_date: string | null; archived_at: string | null } | null }[]>(),
    supabase
      .from("performance_reviews")
      .select("id, status, performance_review_cycles(name, status)")
      .eq("employee_user_id", user.id)
      .eq("status", "not_started")
      .returns<{ id: string; status: string; performance_review_cycles: { name: string; status: string } | null }[]>(),
  ]);

  const actions: PendingAction[] = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const t of overdueTasks) {
    if (t.completed) continue;
    actions.push({ id: `task-${t.id}`, type: "task", title: t.title, subtitle: t.date, href: "/dashboard/tasks", overdue: true });
  }
  for (const t of todayTasks) {
    if (t.completed) continue;
    actions.push({ id: `task-${t.id}`, type: "task", title: t.title, subtitle: null, href: "/dashboard/tasks", overdue: false });
  }

  if (assignedRows.data && assignedRows.data.length > 0) {
    const slugs = assignedRows.data.map((r) => r.assessment_slug);
    const [{ data: results }, { data: attempts }] = await Promise.all([
      supabase.from("assessment_results").select("assessment_slug").eq("user_id", user.id).in("assessment_slug", slugs).returns<{ assessment_slug: string }[]>(),
      supabase
        .from("case_study_exercise_attempts")
        .select("exercise_slug")
        .eq("user_id", user.id)
        .not("submitted_at", "is", null)
        .in("exercise_slug", slugs)
        .returns<{ exercise_slug: string }[]>(),
    ]);
    const completedSlugs = new Set([...(results ?? []).map((r) => r.assessment_slug), ...(attempts ?? []).map((a) => a.exercise_slug)]);
    for (const row of assignedRows.data) {
      if (completedSlugs.has(row.assessment_slug)) continue;
      actions.push({
        id: `assessment-${row.id}`,
        type: "assessment",
        title: resolveAssignableName(row.assessment_slug),
        subtitle: null,
        href: "/dashboard/assessments",
        overdue: false,
      });
    }
  }

  if (kbRows.data && kbRows.data.length > 0) {
    const contentIds = kbRows.data.map((r) => r.content_id);
    const { data: completions } = await supabase
      .from("knowledge_hub_completions")
      .select("content_id")
      .eq("employee_user_id", user.id)
      .in("content_id", contentIds)
      .returns<{ content_id: string }[]>();
    const completedIds = new Set((completions ?? []).map((c) => c.content_id));

    for (const row of kbRows.data) {
      const content = row.knowledge_hub_content;
      if (!content || content.archived_at || completedIds.has(row.content_id)) continue;
      actions.push({
        id: `kb-${row.id}`,
        type: "knowledge_hub",
        title: content.title,
        subtitle: content.due_date,
        href: "/dashboard/knowledge-hub",
        overdue: !!content.due_date && content.due_date < today,
      });
    }
  }

  for (const row of reviewRows.data ?? []) {
    const cycle = row.performance_review_cycles;
    if (!cycle || cycle.status !== "open") continue;
    actions.push({
      id: `review-${row.id}`,
      type: "performance_review",
      title: cycle.name,
      subtitle: null,
      href: "/dashboard/impact-cycle",
      overdue: false,
    });
  }

  // Onboarding steps still open — 'manager_approval' steps are excluded
  // since those are the MANAGER's action, not this employee's (they show
  // on My Team for the manager instead). 'knowledge_hub' steps self-heal
  // their completed_at via getMyOnboarding elsewhere, but that function
  // isn't called here, so a knowledge_hub step's real Knowledge Hub
  // completion is already separately surfaced by the "knowledge_hub"
  // action type above — including it again here via onboarding_instance_
  // steps would double-list the same document under two action types.
  const { data: instance } = await supabase
    .from("onboarding_instances")
    .select("id")
    .eq("employee_user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (instance) {
    const { data: onboardingSteps } = await supabase
      .from("onboarding_instance_steps")
      .select("id, title, due_date, step_type, completed_at")
      .eq("instance_id", instance.id)
      .eq("step_type", "task")
      .is("completed_at", null)
      .returns<{ id: string; title: string; due_date: string | null; step_type: string; completed_at: string | null }[]>();
    for (const step of onboardingSteps ?? []) {
      actions.push({
        id: `onboarding-${step.id}`,
        type: "onboarding",
        title: step.title,
        subtitle: step.due_date,
        href: "/dashboard/onboarding",
        overdue: !!step.due_date && step.due_date < today,
      });
    }
  }

  // Same 7-day window as the standalone UpcomingDeadlinesCard this
  // replaces — milestones further out aren't "needs your attention yet."
  const { data: plans } = await supabase.from("development_plans").select("id").eq("user_id", user.id);
  const planIds = (plans ?? []).map((p) => p.id);
  if (planIds.length > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + MILESTONE_WINDOW_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const { data: milestones } = await supabase
      .from("milestones")
      .select("*")
      .in("plan_id", planIds)
      .eq("completed", false)
      .not("target_date", "is", null)
      .gte("target_date", today)
      .lte("target_date", cutoffStr)
      .returns<Milestone[]>();
    for (const m of milestones ?? []) {
      actions.push({
        id: `milestone-${m.id}`,
        type: "milestone",
        title: m.title,
        subtitle: m.target_date,
        href: "/dashboard/tasks",
        overdue: false,
      });
    }
  }

  return actions;
}
