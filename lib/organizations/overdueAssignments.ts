import { createClient } from "@/lib/supabase/server";

export type OverdueAssignmentCategory = "milestone" | "assessment" | "knowledgeHub";

export type OverdueAssignmentItem = {
  employeeUserId: string;
  employeeName: string | null;
  category: OverdueAssignmentCategory;
  title: string;
  dueDate: string;
};

// Thin wrapper over get_overdue_assignments (migration 0128) — a single
// read-only RPC combining overdue milestones/assessments/Knowledge Hub
// content org-wide, so an admin doesn't have to open each employee's own
// page to see what's overdue. Row cap (50) and "is this actually
// overdue" logic both live in the RPC, not here — see its migration
// comment for why.
export async function getOverdueAssignments(organizationId: string): Promise<OverdueAssignmentItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_overdue_assignments", { target_organization_id: organizationId });
  if (error) {
    console.error("get_overdue_assignments failed:", error);
    return [];
  }
  return (data ?? []).map((row: { employee_user_id: string; employee_name: string | null; category: string; title: string; due_date: string }) => ({
    employeeUserId: row.employee_user_id,
    employeeName: row.employee_name,
    category: row.category as OverdueAssignmentCategory,
    title: row.title,
    dueDate: row.due_date,
  }));
}
