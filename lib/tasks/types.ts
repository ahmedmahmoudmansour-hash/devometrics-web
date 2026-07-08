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
export const TASK_CATEGORIES = [
  { icon: "📚", label: "Learning" },
  { icon: "💻", label: "Deep work" },
  { icon: "🎯", label: "Milestone step" },
  { icon: "💬", label: "Meeting" },
  { icon: "📝", label: "Planning / admin" },
  { icon: "🧠", label: "Reflection / review" },
  { icon: "🤝", label: "Networking / mentorship" },
  { icon: "📊", label: "Reporting" },
  { icon: "🗣️", label: "Practice" },
  { icon: "☕", label: "Break / rest" },
] as const;

export function categoryLabel(icon: string | null): string | null {
  return TASK_CATEGORIES.find((c) => c.icon === icon)?.label ?? null;
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
