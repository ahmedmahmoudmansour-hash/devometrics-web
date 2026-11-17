export type PendingActionType = "task" | "assessment" | "role_assessment" | "knowledge_check" | "knowledge_hub" | "performance_review" | "milestone";

export type PendingAction = {
  id: string;
  type: PendingActionType;
  title: string;
  subtitle: string | null;
  href: string;
  overdue: boolean;
};
