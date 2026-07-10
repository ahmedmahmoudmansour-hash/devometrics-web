import { createClient } from "@/lib/supabase/server";
import { COMPETENCY_DIMENSIONS, type CompetencyDimension } from "@/lib/gap-analysis/dimensions";
import type {
  AssessmentResult,
  DevelopmentPlan,
  GapAnalysis,
  Milestone,
  OrganizationCompetency,
  Profile,
} from "@/lib/supabase/types";

export type WorkforceRow = {
  userId: string;
  memberId: string | null;
  name: string;
  email: string;
  title: string | null;
  department: string | null;
  country: string | null;
  managerName: string | null;
  businessUnit: string | null;
  location: string | null;
  avatarUrl: string | null;
  careerHealthScore: number | null;
  dimensionLevels: Partial<Record<CompetencyDimension, number>>;
  assessmentsCompleted: number;
  plans: number;
  milestonesDone: number;
  milestonesTotal: number;
};

export type CompanyData = {
  isOrgAdmin: boolean;
  organizationId: string | null;
  organizationName: string | null;
  organizationSlug: string | null;
  organizationWebsite: string | null;
  organizationEmployeeCount: string | null;
  organizationIndustry: string | null;
  organizationPlatformContactName: string | null;
  organizationPlatformContactEmail: string | null;
  organizationFinanceContactName: string | null;
  organizationFinanceContactEmail: string | null;
  organizationLogoUrl: string | null;
  organizationBrandColor: string | null;
  rows: WorkforceRow[];
  companyCareerHealthScore: number | null;
  dimensionAverages: Partial<Record<CompetencyDimension, number>>;
  // Directional leadership-readiness signal, not a formal succession plan —
  // there's no job-title/org-chart/critical-role data captured anywhere in
  // this product yet, and a real succession plan needs that. Ranking people
  // by their own Leadership/Strategic Thinking/People Management scores is
  // an honest starting signal, not a claim of having solved succession
  // planning end to end.
  leadershipReadiness: { userId: string; name: string; avatarUrl: string | null; score: number }[];
  pendingInvites: { id: string; email: string; title: string | null; department: string | null; country: string | null }[];
  organizationCompetencies: OrganizationCompetency[];
};

const LEADERSHIP_DIMENSIONS: CompetencyDimension[] = ["Leadership", "Strategic Thinking", "People Management"];

export async function buildCompanyData(): Promise<CompanyData> {
  const empty: CompanyData = {
    isOrgAdmin: false,
    organizationId: null,
    organizationName: null,
    organizationSlug: null,
    organizationWebsite: null,
    organizationEmployeeCount: null,
    organizationIndustry: null,
    organizationPlatformContactName: null,
    organizationPlatformContactEmail: null,
    organizationFinanceContactName: null,
    organizationFinanceContactEmail: null,
    organizationLogoUrl: null,
    organizationBrandColor: null,
    rows: [],
    companyCareerHealthScore: null,
    dimensionAverages: {},
    leadershipReadiness: [],
    pendingInvites: [],
    organizationCompetencies: [],
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const { data: membership } = await supabase
    .from("organization_members")
    .select("*, organizations(name, slug, website, employee_count, industry)")
    .eq("user_id", user.id)
    .maybeSingle<{
      organization_id: string;
      role: string;
      organizations: { name: string; slug: string; website: string | null; employee_count: string | null; industry: string | null };
    }>();

  if (!membership || membership.role !== "admin") return empty;

  // Fetched separately, deliberately isolated from the query above — these
  // columns were added in a later migration, and a missing column here must
  // never break the core admin-access check that the rest of this dashboard
  // depends on. If the migration hasn't run yet, this just silently yields
  // nulls instead of taking down the whole page.
  const { data: contactFields } = await supabase
    .from("organizations")
    .select(
      "platform_contact_name, platform_contact_email, finance_contact_name, finance_contact_email, logo_url, brand_color"
    )
    .eq("id", membership.organization_id)
    .maybeSingle<{
      platform_contact_name: string | null;
      platform_contact_email: string | null;
      finance_contact_name: string | null;
      finance_contact_email: string | null;
      logo_url: string | null;
      brand_color: string | null;
    }>();

  const [{ data: members }, { data: invites }, { data: competencies }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("id, user_id, title")
      .eq("organization_id", membership.organization_id)
      .returns<{ id: string; user_id: string; title: string | null }[]>(),
    supabase
      .from("organization_invites")
      .select("id, email, title")
      .eq("organization_id", membership.organization_id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false })
      .returns<{ id: string; email: string; title: string | null }[]>(),
    // New table (migration 0035) — a query error here (e.g. migration not
    // run yet) just yields an empty framework, never breaks the rest of
    // this dashboard.
    supabase
      .from("organization_competencies")
      .select("*")
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: true })
      .returns<OrganizationCompetency[]>(),
  ]);

  // department/country (migration 0048) fetched separately, same reasoning
  // as contactFields above — a missing column here must never take down the
  // members/invites lists the rest of this dashboard depends on.
  const [{ data: memberLocations }, { data: inviteLocations }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("user_id, department, country")
      .eq("organization_id", membership.organization_id)
      .returns<{ user_id: string; department: string | null; country: string | null }[]>(),
    supabase
      .from("organization_invites")
      .select("id, department, country")
      .eq("organization_id", membership.organization_id)
      .is("accepted_at", null)
      .returns<{ id: string; department: string | null; country: string | null }[]>(),
  ]);
  const locationByMemberUser = new Map((memberLocations ?? []).map((m) => [m.user_id, m]));
  const locationByInviteId = new Map((inviteLocations ?? []).map((i) => [i.id, i]));

  // manager/business unit/location/archived (migration 0049) — same
  // isolated-query pattern again: before that migration runs, this yields
  // nothing and every member simply shows as active with blank HR fields.
  const { data: memberHrFields } = await supabase
    .from("organization_members")
    .select("id, user_id, manager_name, business_unit, location, archived")
    .eq("organization_id", membership.organization_id)
    .returns<{ id: string; user_id: string; manager_name: string | null; business_unit: string | null; location: string | null; archived: boolean }[]>();
  const hrByMemberUser = new Map((memberHrFields ?? []).map((m) => [m.user_id, m]));

  const pendingInvites = (invites ?? []).map((invite) => ({
    ...invite,
    department: locationByInviteId.get(invite.id)?.department ?? null,
    country: locationByInviteId.get(invite.id)?.country ?? null,
  }));
  const organizationCompetencies = competencies ?? [];
  // Archived members stay in the database for history but drop out of the
  // workforce view and every aggregate below.
  const activeMembers = (members ?? []).filter((m) => hrByMemberUser.get(m.user_id)?.archived !== true);
  const memberIds = activeMembers.map((m) => m.user_id);
  const titleByUser = new Map(activeMembers.map((m) => [m.user_id, m.title]));
  const memberIdByUser = new Map(activeMembers.map((m) => [m.user_id, m.id]));
  const orgIdentity = {
    organizationId: membership.organization_id,
    organizationName: membership.organizations.name,
    organizationSlug: membership.organizations.slug,
    organizationWebsite: membership.organizations.website,
    organizationEmployeeCount: membership.organizations.employee_count,
    organizationIndustry: membership.organizations.industry,
    organizationPlatformContactName: contactFields?.platform_contact_name ?? null,
    organizationPlatformContactEmail: contactFields?.platform_contact_email ?? null,
    organizationFinanceContactName: contactFields?.finance_contact_name ?? null,
    organizationFinanceContactEmail: contactFields?.finance_contact_email ?? null,
    organizationLogoUrl: contactFields?.logo_url ?? null,
    organizationBrandColor: contactFields?.brand_color ?? null,
  };
  if (memberIds.length === 0) {
    return {
      ...empty,
      isOrgAdmin: true,
      ...orgIdentity,
      pendingInvites,
      organizationCompetencies,
    };
  }

  const [{ data: profiles }, { data: analyses }, { data: results }, { data: plans }] = await Promise.all([
    supabase.from("profiles").select("*").in("id", memberIds).returns<Profile[]>(),
    supabase
      .from("gap_analyses")
      .select("*")
      .in("user_id", memberIds)
      .order("created_at", { ascending: false })
      .returns<GapAnalysis[]>(),
    supabase.from("assessment_results").select("*").in("user_id", memberIds).returns<AssessmentResult[]>(),
    supabase.from("development_plans").select("*").in("user_id", memberIds).returns<DevelopmentPlan[]>(),
  ]);

  const planIds = (plans ?? []).map((p) => p.id);
  const { data: milestones } = planIds.length
    ? await supabase.from("milestones").select("*").in("plan_id", planIds).returns<Milestone[]>()
    : { data: [] as Milestone[] };

  const latestAnalysisByUser = new Map<string, GapAnalysis>();
  for (const a of analyses ?? []) {
    if (!latestAnalysisByUser.has(a.user_id)) latestAnalysisByUser.set(a.user_id, a);
  }

  const assessmentCountByUser = new Map<string, Set<string>>();
  for (const r of results ?? []) {
    const set = assessmentCountByUser.get(r.user_id) ?? new Set<string>();
    set.add(r.assessment_slug);
    assessmentCountByUser.set(r.user_id, set);
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

  const rows: WorkforceRow[] = (profiles ?? []).map((p) => {
    const analysis = latestAnalysisByUser.get(p.id);
    const dimensionLevels: Partial<Record<CompetencyDimension, number>> = {};
    if (analysis) {
      for (const c of analysis.competencies) dimensionLevels[c.dimension] = c.currentLevel;
    }
    const stats = milestoneStatsByUser.get(p.id) ?? { done: 0, total: 0 };
    return {
      userId: p.id,
      memberId: memberIdByUser.get(p.id) ?? null,
      name: p.full_name ?? "—",
      email: p.email ?? "—",
      title: titleByUser.get(p.id) ?? null,
      department: locationByMemberUser.get(p.id)?.department ?? null,
      country: locationByMemberUser.get(p.id)?.country ?? null,
      managerName: hrByMemberUser.get(p.id)?.manager_name ?? null,
      businessUnit: hrByMemberUser.get(p.id)?.business_unit ?? null,
      location: hrByMemberUser.get(p.id)?.location ?? null,
      avatarUrl: p.avatar_url ?? null,
      careerHealthScore: analysis?.career_health_score ?? null,
      dimensionLevels,
      assessmentsCompleted: assessmentCountByUser.get(p.id)?.size ?? 0,
      plans: planCountByUser.get(p.id) ?? 0,
      milestonesDone: stats.done,
      milestonesTotal: stats.total,
    };
  });

  const careerHealthScores = rows.map((r) => r.careerHealthScore).filter((v): v is number => v !== null);
  const companyCareerHealthScore = careerHealthScores.length
    ? Math.round(careerHealthScores.reduce((a, b) => a + b, 0) / careerHealthScores.length)
    : null;

  const dimensionAverages: Partial<Record<CompetencyDimension, number>> = {};
  for (const dim of COMPETENCY_DIMENSIONS) {
    const values = rows.map((r) => r.dimensionLevels[dim]).filter((v): v is number => v !== undefined);
    if (values.length) dimensionAverages[dim] = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }

  const leadershipReadiness = rows
    .map((r) => {
      const values = LEADERSHIP_DIMENSIONS.map((d) => r.dimensionLevels[d]).filter((v): v is number => v !== undefined);
      if (values.length === 0) return null;
      return {
        userId: r.userId,
        name: r.name,
        avatarUrl: r.avatarUrl,
        score: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      };
    })
    .filter((r): r is { userId: string; name: string; avatarUrl: string | null; score: number } => r !== null)
    .sort((a, b) => b.score - a.score);

  return {
    isOrgAdmin: true,
    ...orgIdentity,
    rows,
    companyCareerHealthScore,
    dimensionAverages,
    leadershipReadiness,
    pendingInvites,
    organizationCompetencies,
  };
}

export type EmployeeDetail = {
  isAuthorized: boolean;
  profile: { id: string; name: string; email: string; avatarUrl: string | null; title: string | null } | null;
  plans: (DevelopmentPlan & { milestones: Milestone[] })[];
};

// Single-employee drill-down for the admin task-assignment flow. Authorization
// is a direct same-organization membership check (not just is_org_admin_of_user,
// which only proves *some* shared org — this confirms it's specifically the
// admin's own org membership row), so an admin from Org A can never load an
// Org B employee's page by guessing their user id.
export async function buildEmployeeDetail(employeeUserId: string): Promise<EmployeeDetail> {
  const empty: EmployeeDetail = { isAuthorized: false, profile: null, plans: [] };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .maybeSingle<{ organization_id: string; role: string }>();
  if (!membership || membership.role !== "admin") return empty;

  const { data: targetMembership } = await supabase
    .from("organization_members")
    .select("user_id, title")
    .eq("organization_id", membership.organization_id)
    .eq("user_id", employeeUserId)
    .maybeSingle<{ user_id: string; title: string | null }>();
  if (!targetMembership) return empty;

  const [{ data: profile }, { data: plans }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", employeeUserId).single<Profile>(),
    supabase
      .from("development_plans")
      .select("*")
      .eq("user_id", employeeUserId)
      .order("created_at", { ascending: false })
      .returns<DevelopmentPlan[]>(),
  ]);

  const planIds = (plans ?? []).map((p) => p.id);
  const { data: milestones } = planIds.length
    ? await supabase
        .from("milestones")
        .select("*")
        .in("plan_id", planIds)
        .order("position")
        .returns<Milestone[]>()
    : { data: [] as Milestone[] };

  const milestonesByPlan = new Map<string, Milestone[]>();
  for (const m of milestones ?? []) {
    const list = milestonesByPlan.get(m.plan_id) ?? [];
    list.push(m);
    milestonesByPlan.set(m.plan_id, list);
  }

  return {
    isAuthorized: true,
    profile: profile
      ? {
          id: profile.id,
          name: profile.full_name ?? "—",
          email: profile.email ?? "—",
          avatarUrl: profile.avatar_url,
          title: targetMembership.title,
        }
      : null,
    plans: (plans ?? []).map((p) => ({ ...p, milestones: milestonesByPlan.get(p.id) ?? [] })),
  };
}
