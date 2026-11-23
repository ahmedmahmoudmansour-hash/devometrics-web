// Reads what the readiness page needs from the signed-in admin's company. Runs as that admin, so every database rule applies. Each query that
// fails (a table that is not there yet, for example) counts as "nothing yet" rather than breaking the page.
import { createClient } from "@/lib/supabase/server";
import { hasLeft } from "@/lib/organizations/leaver";
import type { ReadinessAssessment, ReadinessInput } from "./core";

// Every row a query matches, a page at a time. The API returns at most a fixed number of rows per request (1,000 by default on Supabase), and
// a single request would silently stop there. Advancing by the rows actually returned works whatever that limit is set to. A failed page ends
// the read with what was read so far ("nothing yet" for a table that is not there), matching how the rest of this loader treats errors.
async function allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, cap = 50_000): Promise<T[]> {
  const out: T[] = [];
  while (out.length < cap) {
    const { data, error } = await page(out.length, out.length + 999);
    if (error || !data || data.length === 0) break;
    out.push(...data);
  }
  return out;
}

type Snapshot = { definition_version_id: string; required_level: number | null }[];

// With `onlyUserIds` (a manager's direct reports) it reads only those people and their assessments. Development plans are private to the
// person and their admins, so a manager's view leaves them out.
export async function loadReadinessInput(organizationId: string, onlyUserIds?: string[]): Promise<ReadinessInput> {
  const scoped = onlyUserIds !== undefined;
  if (scoped && onlyUserIds.length === 0) return { roles: [], members: [], assessments: [], competencyNames: {}, plansByUser: {} };
  const supabase = await createClient();

  const memberPage = (from: number, to: number) => {
    let q = supabase.from("organization_members").select("user_id, current_role_id, archived, employment_status").eq("organization_id", organizationId);
    if (scoped) q = q.in("user_id", onlyUserIds);
    return q.order("user_id").range(from, to).returns<{ user_id: string; current_role_id: string | null; archived: boolean | null; employment_status: string | null }[]>();
  };
  const assessmentPage = (from: number, to: number) => {
    let q = supabase
      .from("competency_assessments")
      .select("id, employee_user_id, role_id, status, created_at, required_snapshot")
      .eq("organization_id", organizationId);
    if (scoped) q = q.in("employee_user_id", onlyUserIds);
    return q
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to)
      .returns<{ id: string; employee_user_id: string; role_id: string | null; status: string; created_at: string; required_snapshot: Snapshot | null }[]>();
  };
  const [{ data: famRows }, roleRows, memberRows, allAssessmentRows] = await Promise.all([
    supabase.from("job_families").select("id, name").eq("organization_id", organizationId).returns<{ id: string; name: string }[]>(),
    allRows((from, to) =>
      supabase.from("job_roles").select("id, title, grade, job_family_id").eq("organization_id", organizationId).order("id").range(from, to).returns<{ id: string; title: string; grade: number; job_family_id: string }[]>(),
    ),
    allRows(memberPage),
    allRows(assessmentPage),
  ]);

  // Someone who has left (archived, resigned or terminated) is not a person to be ready for a job, and their open assessments are not waiting on anyone.
  const active = memberRows.filter((m) => !hasLeft(m));
  const userIds = active.map((m) => m.user_id);
  const activeIds = new Set(userIds);
  const assessmentRows = allAssessmentRows.filter((a) => activeIds.has(a.employee_user_id));
  const nameById = new Map<string, string>();
  for (let i = 0; i < userIds.length; i += 200) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds.slice(i, i + 200)).returns<{ id: string; full_name: string | null; email: string | null }[]>();
    for (const p of profiles ?? []) nameById.set(p.id, p.full_name?.trim() || p.email || "—");
  }

  const scoredIds = assessmentRows.filter((a) => a.status === "scored").map((a) => a.id);
  type ResultRow = { assessment_id: string; definition_version_id: string; status: string; level: number | null; override_level: number | null };
  const results: ResultRow[] = [];
  for (let i = 0; i < scoredIds.length; i += 200) {
    const ids = scoredIds.slice(i, i + 200);
    results.push(
      ...(await allRows((from, to) =>
        supabase
          .from("competency_assessment_results")
          .select("assessment_id, definition_version_id, status, level, override_level")
          .in("assessment_id", ids)
          .order("assessment_id")
          .order("definition_version_id")
          .range(from, to)
          .returns<ResultRow[]>(),
      )),
    );
  }

  const versionIds = [...new Set(assessmentRows.flatMap((a) => (a.required_snapshot ?? []).map((s) => s.definition_version_id)))];
  const competencyNames: Record<string, string> = {};
  for (let i = 0; i < versionIds.length; i += 200) {
    const { data } = await supabase.from("competency_definition_versions").select("id, name").in("id", versionIds.slice(i, i + 200)).returns<{ id: string; name: string }[]>();
    for (const v of data ?? []) competencyNames[v.id] = v.name;
  }

  const plansByUser: Record<string, number> = {};
  if (userIds.length && !scoped) {
    const { data: plans } = await supabase.from("development_plans").select("user_id").in("user_id", userIds).returns<{ user_id: string }[]>();
    for (const p of plans ?? []) plansByUser[p.user_id] = (plansByUser[p.user_id] ?? 0) + 1;
  }

  const famName = new Map((famRows ?? []).map((f) => [f.id, f.name]));
  const resultsByAssessment = new Map<string, typeof results>();
  for (const r of results) {
    const list = resultsByAssessment.get(r.assessment_id);
    if (list) list.push(r);
    else resultsByAssessment.set(r.assessment_id, [r]);
  }

  const assessments: ReadinessAssessment[] = assessmentRows.map((a) => ({
    id: a.id,
    userId: a.employee_user_id,
    roleId: a.role_id,
    status: a.status,
    createdAt: a.created_at,
    snapshot: (a.required_snapshot ?? []).map((s) => ({ versionId: s.definition_version_id, requiredLevel: s.required_level })),
    results: (resultsByAssessment.get(a.id) ?? []).map((r) => ({ versionId: r.definition_version_id, status: r.status, level: r.level, overrideLevel: r.override_level })),
  }));

  return {
    roles: roleRows.map((r) => ({ id: r.id, title: r.title, family: famName.get(r.job_family_id) ?? "", grade: r.grade })),
    members: active.map((m) => ({ userId: m.user_id, name: nameById.get(m.user_id) ?? "—", roleId: m.current_role_id })),
    assessments,
    competencyNames,
    plansByUser,
  };
}
