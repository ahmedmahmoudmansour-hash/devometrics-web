// Everything one person has been assigned or has finished, from both new assessment kinds, newest first. Used on the person's own
// page so the link between an employee and their assessments is visible in one place. Row level security decides what the viewer
// may see (admin: anyone in the company; manager: their reports).
import { createClient } from "@/lib/supabase/server";
import { scoreRow, type CheckRow } from "@/lib/knowledgeBank/view";

export type EmployeeAssessmentItem =
  | { key: string; kind: "role"; roleTitle: string; createdAt: string; status: string; href: string }
  | { key: string; kind: "check"; roleTitle: string; createdAt: string; done: boolean; percent: number | null; href: string };

const CHECK_COLUMNS = "id, employee_user_id, role_title, language, bank_version, seed, question_ids, required_levels, answers, created_at, submitted_at";

export async function getEmployeeAssessments(employeeUserId: string): Promise<EmployeeAssessmentItem[]> {
  const supabase = await createClient();
  const [{ data: roles }, { data: checks, error: checkError }] = await Promise.all([
    supabase
      .from("competency_assessments")
      .select("id, role_title, status, created_at")
      .eq("employee_user_id", employeeUserId)
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<{ id: string; role_title: string; status: string; created_at: string }[]>(),
    supabase.from("knowledge_checks").select(CHECK_COLUMNS).eq("employee_user_id", employeeUserId).order("created_at", { ascending: false }).limit(50).returns<CheckRow[]>(),
  ]);
  const items: EmployeeAssessmentItem[] = [
    ...(roles ?? []).map((r) => ({ key: `r-${r.id}`, kind: "role" as const, roleTitle: r.role_title, createdAt: r.created_at, status: r.status, href: `/dashboard/role-assessment/${r.id}` })),
    ...(checkError ? [] : checks ?? []).map((c) => ({
      key: `c-${c.id}`,
      kind: "check" as const,
      roleTitle: c.role_title,
      createdAt: c.created_at,
      done: !!c.submitted_at,
      percent: c.submitted_at ? scoreRow(c).percent : null,
      href: `/dashboard/knowledge-check/${c.id}`,
    })),
  ];
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
