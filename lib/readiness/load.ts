// Reads what the readiness page needs from the signed-in admin's company. Runs as that admin, so every database rule applies. Each query that
// fails (a table that is not there yet, for example) counts as "nothing yet" rather than breaking the page.
import { createClient } from "@/lib/supabase/server";
import type { ReadinessAssessment, ReadinessInput } from "./core";

type Snapshot = { definition_version_id: string; required_level: number | null }[];

export async function loadReadinessInput(organizationId: string): Promise<ReadinessInput> {
  const supabase = await createClient();
  const [{ data: famRows }, { data: roleRows }, { data: memberRows }, { data: assessmentRows }] = await Promise.all([
    supabase.from("job_families").select("id, name").eq("organization_id", organizationId).returns<{ id: string; name: string }[]>(),
    supabase.from("job_roles").select("id, title, grade, job_family_id").eq("organization_id", organizationId).returns<{ id: string; title: string; grade: number; job_family_id: string }[]>(),
    supabase.from("organization_members").select("user_id, current_role_id, archived").eq("organization_id", organizationId).returns<{ user_id: string; current_role_id: string | null; archived: boolean | null }[]>(),
    supabase
      .from("competency_assessments")
      .select("id, employee_user_id, role_id, status, created_at, required_snapshot")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(2000)
      .returns<{ id: string; employee_user_id: string; role_id: string | null; status: string; created_at: string; required_snapshot: Snapshot | null }[]>(),
  ]);

  const active = (memberRows ?? []).filter((m) => !m.archived);
  const userIds = active.map((m) => m.user_id);
  const { data: profiles } = userIds.length ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds).returns<{ id: string; full_name: string | null; email: string | null }[]>() : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name?.trim() || p.email || "—"]));

  const scoredIds = (assessmentRows ?? []).filter((a) => a.status === "scored").map((a) => a.id);
  const results: { assessment_id: string; definition_version_id: string; status: string; level: number | null; override_level: number | null }[] = [];
  for (let i = 0; i < scoredIds.length; i += 200) {
    const { data } = await supabase
      .from("competency_assessment_results")
      .select("assessment_id, definition_version_id, status, level, override_level")
      .in("assessment_id", scoredIds.slice(i, i + 200))
      .returns<{ assessment_id: string; definition_version_id: string; status: string; level: number | null; override_level: number | null }[]>();
    results.push(...(data ?? []));
  }

  const versionIds = [...new Set((assessmentRows ?? []).flatMap((a) => (a.required_snapshot ?? []).map((s) => s.definition_version_id)))];
  const competencyNames: Record<string, string> = {};
  for (let i = 0; i < versionIds.length; i += 200) {
    const { data } = await supabase.from("competency_definition_versions").select("id, name").in("id", versionIds.slice(i, i + 200)).returns<{ id: string; name: string }[]>();
    for (const v of data ?? []) competencyNames[v.id] = v.name;
  }

  const plansByUser: Record<string, number> = {};
  if (userIds.length) {
    const { data: plans } = await supabase.from("development_plans").select("user_id").in("user_id", userIds).returns<{ user_id: string }[]>();
    for (const p of plans ?? []) plansByUser[p.user_id] = (plansByUser[p.user_id] ?? 0) + 1;
  }

  const famName = new Map((famRows ?? []).map((f) => [f.id, f.name]));
  const resultsByAssessment = new Map<string, typeof results>();
  for (const r of results) resultsByAssessment.set(r.assessment_id, [...(resultsByAssessment.get(r.assessment_id) ?? []), r]);

  const assessments: ReadinessAssessment[] = (assessmentRows ?? []).map((a) => ({
    id: a.id,
    userId: a.employee_user_id,
    roleId: a.role_id,
    status: a.status,
    createdAt: a.created_at,
    snapshot: (a.required_snapshot ?? []).map((s) => ({ versionId: s.definition_version_id, requiredLevel: s.required_level })),
    results: (resultsByAssessment.get(a.id) ?? []).map((r) => ({ versionId: r.definition_version_id, status: r.status, level: r.level, overrideLevel: r.override_level })),
  }));

  return {
    roles: (roleRows ?? []).map((r) => ({ id: r.id, title: r.title, family: famName.get(r.job_family_id) ?? "", grade: r.grade })),
    members: active.map((m) => ({ userId: m.user_id, name: nameById.get(m.user_id) ?? "—", roleId: m.current_role_id })),
    assessments,
    competencyNames,
    plansByUser,
  };
}
