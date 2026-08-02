export type PersonalSubtask = {
  id: string;
  text: string;
  done: boolean;
};

export type TaskRecurring = "none" | "daily" | "weekdays" | "weekly" | "monthly";
export type TaskPriority = "high" | "medium" | "low";

// Every icon carries a clear label — a bare emoji picker is decorative and
// unclear (someone has to guess what 📊 is "for"), so this pairs each glyph
// with what it actually means, shown as a tooltip and next to the icon
// wherever there's room. "Break / Rest" is deliberate, not an afterthought —
// Tiimo's whole design point is keeping downtime visible on the same
// schedule as work, not just grinding through a task list.
// label is a plain English fallback only (e.g. for contexts without a
// translation function handy) — the icon is what's actually stored on a
// task (PersonalTask.icon), so translating the label is purely a display
// concern. Real UI should call categoryTranslationKey() + t() instead,
// same "stable identifier + translated display label" pattern used for
// PersonalizationFields' career-stage/accommodation options.
export const TASK_CATEGORIES = [
  { icon: "📚", label: "Learning", translationKey: "categoryLearning" },
  { icon: "💻", label: "Deep work", translationKey: "categoryDeepWork" },
  { icon: "🎯", label: "Milestone step", translationKey: "categoryMilestoneStep" },
  { icon: "💬", label: "Meeting", translationKey: "categoryMeeting" },
  { icon: "📝", label: "Planning / admin", translationKey: "categoryPlanningAdmin" },
  { icon: "🧠", label: "Reflection / review", translationKey: "categoryReflectionReview" },
  { icon: "🤝", label: "Networking / mentorship", translationKey: "categoryNetworkingMentorship" },
  { icon: "📊", label: "Reporting", translationKey: "categoryReporting" },
  { icon: "🗣️", label: "Practice", translationKey: "categoryPractice" },
  { icon: "☕", label: "Break / rest", translationKey: "categoryBreakRest" },
] as const;

export function categoryLabel(icon: string | null): string | null {
  return TASK_CATEGORIES.find((c) => c.icon === icon)?.label ?? null;
}

export function categoryTranslationKey(icon: string | null): string | null {
  return TASK_CATEGORIES.find((c) => c.icon === icon)?.translationKey ?? null;
}

export type PersonalTask = {
  id: string;
  user_id: string;
  milestone_id: string | null;
  title: string;
  subtasks: PersonalSubtask[];
  recurring: TaskRecurring;
  date: string;
  time: string | null;
  completed: boolean;
  completed_at: string | null;
  notes: string | null;
  priority: TaskPriority;
  icon: string | null;
  created_at: string;
};
