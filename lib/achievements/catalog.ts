export type AchievementKey =
  | "first_assessment"
  | "first_gap_analysis"
  | "first_plan"
  | "first_milestone_completed"
  | "resume_checked"
  | "first_task_completed"
  | "streak_7"
  | "streak_30";

export type AchievementDefinition = {
  key: AchievementKey;
  label: string;
  description: string;
  icon: string;
};

// Order here is display order — roughly the order a new user would
// naturally earn them, onboarding steps first, streaks last.
export const ACHIEVEMENTS: AchievementDefinition[] = [
  { key: "first_assessment", label: "Assessment Ace", description: "Completed your first assessment", icon: "🎯" },
  { key: "first_gap_analysis", label: "Gap Mapped", description: "Completed your first Gap Analysis", icon: "🗺️" },
  { key: "first_plan", label: "Plan in Motion", description: "Created your first development plan", icon: "🚀" },
  { key: "first_milestone_completed", label: "First Win", description: "Completed your first milestone", icon: "✅" },
  { key: "resume_checked", label: "Resume Ready", description: "Checked your Resume Intelligence score", icon: "📄" },
  { key: "first_task_completed", label: "Daily Doer", description: "Completed your first daily task", icon: "📌" },
  { key: "streak_7", label: "Consistent", description: "Maintained a 7-day streak", icon: "🔥" },
  { key: "streak_30", label: "Dedicated", description: "Maintained a 30-day streak", icon: "💎" },
];
