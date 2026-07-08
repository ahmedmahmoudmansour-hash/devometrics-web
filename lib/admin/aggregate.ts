import { createClient } from "@/lib/supabase/server";
import { ASSESSMENTS } from "@/lib/assessments/catalog";
import type { AssessmentResult, DevelopmentPlan, GapAnalysis, Milestone, Profile } from "@/lib/supabase/types";

export type PilotRow = {
  userId: string;
  name: string;
  email: string;
  organizationName: string | null;
  joined: string;
  careerHealthScore: number | null;
  assessmentsCompleted: number;
  totalAssessments: number;
  plans: number;
  milestonesDone: number;
  milestonesTotal: number;
};

// Admin-only aggregation for the pilot tracking view. Relies entirely on the
// "Admins can view all X" RLS policies added in migration 0013 — there is no
// service_role key in this app, so this only works for a user whose profile
// row has is_admin = true, and returns nothing extra for anyone else.
export async function buildPilotRows(): Promise<{ isAdmin: boolean; rows: PilotRow[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { isAdmin: false, rows: [] };

  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single<{ is_admin: boolean }>();
  if (!ownProfile?.is_admin) return { isAdmin: false, rows: [] };

  const [{ data: profiles }, { data: analyses }, { data: results }, { data: plans }, { data: memberships }] =
    await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: true }).returns<Profile[]>(),
      supabase
        .from("gap_analyses")
        .select("*")
        .order("created_at", { ascending: false })
        .returns<GapAnalysis[]>(),
      supabase.from("assessment_results").select("*").returns<AssessmentResult[]>(),
      supabase.from("development_plans").select("*").returns<DevelopmentPlan[]>(),
      supabase
        .from("organization_members")
        .select("user_id, organizations(name)")
        .returns<{ user_id: string; organizations: { name: string } }[]>(),
    ]);

  const orgNameByUser = new Map<string, string>();
  for (const m of memberships ?? []) {
    orgNameByUser.set(m.user_id, m.organizations.name);
  }

  const planIds = (plans ?? []).map((p) => p.id);
  const { data: milestones } = planIds.length
    ? await supabase.from("milestones").select("*").in("plan_id", planIds).returns<Milestone[]>()
    : { data: [] as Milestone[] };

  const latestScoreByUser = new Map<string, number>();
  for (const a of analyses ?? []) {
    if (!latestScoreByUser.has(a.user_id)) latestScoreByUser.set(a.user_id, a.career_health_score);
  }

  const assessedSlugsByUser = new Map<string, Set<string>>();
  for (const r of results ?? []) {
    const set = assessedSlugsByUser.get(r.user_id) ?? new Set<string>();
    set.add(r.assessment_slug);
    assessedSlugsByUser.set(r.user_id, set);
  }

  const planCountByUser = new Map<string, number>();
  const planUserById = new Map<string, string>();
  for (const p of plans ?? []) {
    planCountByUser.set(p.user_id, (planCountByUser.get(p.user_id) ?? 0) + 1);
    planUserById.set(p.id, p.user_id);
  }

  const milestoneStatsByUser = new Map<string, { done: number; total: number }>();
  for (const m of milestones ?? []) {
    const userId = planUserById.get(m.plan_id);
    if (!userId) continue;
    const stats = milestoneStatsByUser.get(userId) ?? { done: 0, total: 0 };
    stats.total += 1;
    if (m.completed) stats.done += 1;
    milestoneStatsByUser.set(userId, stats);
  }

  const rows: PilotRow[] = (profiles ?? []).map((p) => {
    const stats = milestoneStatsByUser.get(p.id) ?? { done: 0, total: 0 };
    return {
      userId: p.id,
      name: p.full_name ?? "—",
      email: p.email ?? "—",
      organizationName: orgNameByUser.get(p.id) ?? null,
      joined: p.created_at,
      careerHealthScore: latestScoreByUser.get(p.id) ?? null,
      assessmentsCompleted: assessedSlugsByUser.get(p.id)?.size ?? 0,
      totalAssessments: ASSESSMENTS.length,
      plans: planCountByUser.get(p.id) ?? 0,
      milestonesDone: stats.done,
      milestonesTotal: stats.total,
    };
  });

  return { isAdmin: true, rows };
}
