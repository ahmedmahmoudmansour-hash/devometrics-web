"use server";

// Role-based competency assessments: assign, answer, score, confirm. Database rules (who can see and change what)
// live in migration 0204 and hold even if these actions are bypassed; the checks here give friendlier errors early.

import { roleContextKey } from "@/lib/assessment/roleContext";
import { availableOn, pickerInfo, type PickerRole } from "@/lib/assessment/employeePicker";
import { sendAssessmentAssignedEmail } from "@/lib/assessment/assignedEmail";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { COMPETENCY_DIMENSIONS } from "@/lib/gap-analysis/dimensions";
import { proficiencyLevel } from "@/lib/proficiency/levels";
import type { CompetencyCategory } from "@/lib/proficiency/library";
import { assertAiBudgetOk, recordAiUsage } from "@/lib/aiUsage/track";
import { resolveCallerLocale } from "@/lib/i18n/request";
import {
  STANDARD_WORDING_VERSION,
  companyItemStyle,
  isAssessmentLanguage,
  isStandardDimension,
  standardDefinitionText,
  standardItemStyle,
  type AssessmentLanguage,
  type DefinitionText,
  type ItemStyle,
} from "@/lib/assessment/definitions";
import { generateQuestions, scoreCompetency, type Usage } from "@/lib/assessment/ai";
import { SCORING_METHOD_VERSION } from "@/lib/assessment/scoring";
import {
  DEFAULT_ASSESSMENT_SETTINGS,
  type AssignableEmployee,
  type AssessmentSettings,
  type CompetencyEntry,
  type ResultView,
  type RoleAssessmentRow,
  type RoleAssessmentView,
} from "@/lib/assessment/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const MAX_ANSWER = 6000;

type Member = { organization_id: string; role: "admin" | "member"; current_role_id: string | null; manager_user_id: string | null };

async function context(): Promise<{ supabase: Supabase; userId: string; member: Member } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const { data: member } = await supabase
    .from("organization_members")
    .select("organization_id, role, current_role_id, manager_user_id")
    .eq("user_id", user.id)
    .maybeSingle<Member>();
  if (!member) return { error: "You are not part of a company workspace" };
  return { supabase, userId: user.id, member };
}

function revalidate() {
  revalidatePath("/dashboard/role-assessment");
  revalidatePath("/dashboard/company/role-assessments");
  revalidatePath("/dashboard/my-team/role-assessments");
}

// ---------------------------------------------------------------------------------------------------------------
// Settings

export async function getAssessmentSettings(organizationId?: string): Promise<AssessmentSettings> {
  const ctx = await context();
  if ("error" in ctx) return DEFAULT_ASSESSMENT_SETTINGS;
  const { data } = await ctx.supabase
    .from("competency_assessment_settings")
    .select("items_per_competency, max_competencies, self_start_allowed, retention_months, retake_interval_days")
    .eq("organization_id", organizationId ?? ctx.member.organization_id)
    .maybeSingle<{ items_per_competency: number; max_competencies: number; self_start_allowed: boolean; retention_months: number; retake_interval_days: number }>();
  if (!data) return DEFAULT_ASSESSMENT_SETTINGS;
  return {
    itemsPerCompetency: data.items_per_competency,
    maxCompetencies: data.max_competencies,
    selfStartAllowed: data.self_start_allowed,
    retentionMonths: data.retention_months,
    retakeIntervalDays: data.retake_interval_days,
  };
}

export async function updateAssessmentSettings(next: AssessmentSettings) {
  const ctx = await context();
  if ("error" in ctx) return { error: ctx.error };
  if (ctx.member.role !== "admin") return { error: "Only a company admin can change these settings" };
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(n))));
  const { error } = await ctx.supabase.from("competency_assessment_settings").upsert(
    {
      organization_id: ctx.member.organization_id,
      items_per_competency: clamp(next.itemsPerCompetency, 1, 10),
      max_competencies: clamp(next.maxCompetencies, 1, 30),
      self_start_allowed: !!next.selfStartAllowed,
      retention_months: clamp(next.retentionMonths, 1, 120),
      retake_interval_days: clamp(next.retakeIntervalDays, 0, 365),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" }
  );
  if (error) {
    console.error("updateAssessmentSettings failed:", error);
    return { error: "Could not save the settings. The database may need migration 0204 run first." };
  }
  revalidate();
  return { success: true };
}

// ---------------------------------------------------------------------------------------------------------------
// Making an assessment

type Requirement = { key: string; kind: "standard" | "company"; target: number };
type CompanyCompetencyRow = { id: string; name: string; description: string | null; category: CompetencyCategory | null; level_indicators: Record<string, string> | null };

// Writes the questions for one competency version and level band once, then reuses them for everyone.
async function ensureItems(
  supabase: Supabase,
  input: { organizationId: string; versionId: string; band: number; language: AssessmentLanguage; count: number; definition: DefinitionText; style: ItemStyle; roleTitle: string }
): Promise<{ items: { id: string; position: number }[]; usage: Usage | null }> {
  // Questions are written once per role (migration 0206) and reused for everyone in that role. Until that migration is
  // applied the column does not exist: the first read then fails with 42703 and everything falls back to the earlier
  // behaviour (shared by competency, level and language).
  const roleContext = roleContextKey(input.roleTitle);
  let legacy = false;
  const read = async (): Promise<{ id: string; position: number }[]> => {
    let query = supabase
      .from("competency_assessment_items")
      .select("id, position")
      .eq("definition_version_id", input.versionId)
      .eq("required_band", input.band)
      .eq("language", input.language);
    if (!legacy) query = query.eq("role_context", roleContext);
    const { data, error } = await query.order("position", { ascending: true }).returns<{ id: string; position: number }[]>();
    if (error && !legacy && error.code === "42703") {
      legacy = true;
      return read();
    }
    return data ?? [];
  };
  let existing = await read();
  if (existing.length >= input.count) return { items: existing.slice(0, input.count), usage: null };

  const missing = input.count - existing.length;
  const { prompts, usage } = await generateQuestions({ definition: input.definition, style: input.style, requiredBand: input.band, roleTitle: input.roleTitle, language: input.language, count: missing });
  const rows = prompts.map((prompt, i) => ({
    organization_id: input.organizationId,
    definition_version_id: input.versionId,
    required_band: input.band,
    language: input.language,
    ...(legacy ? {} : { role_context: roleContext }),
    position: existing.length + i + 1,
    style: input.style,
    prompt,
    model: usage.model,
  }));
  const { error } = await supabase.from("competency_assessment_items").insert(rows);
  // A parallel request may have written the same positions first (unique key): read what is there.
  if (error && error.code !== "23505") throw new Error(`Could not save questions: ${error.message}`);
  existing = await read();
  if (existing.length < input.count) throw new Error("Questions were not saved");
  return { items: existing.slice(0, input.count), usage };
}

async function createAssessment(ctx: { supabase: Supabase; userId: string; member: Member }, employeeUserId: string, route: "assigned" | "self") {
  const { supabase, member } = ctx;
  const orgId = member.organization_id;

  // The person and their role.
  const { data: employee } = await supabase
    .from("organization_members")
    .select("user_id, current_role_id, manager_user_id")
    .eq("organization_id", orgId)
    .eq("user_id", employeeUserId)
    .maybeSingle<{ user_id: string; current_role_id: string | null; manager_user_id: string | null }>();
  if (!employee) return { error: "That person is not in your company" };
  if (route === "assigned" && !(member.role === "admin" || employee.manager_user_id === ctx.userId)) return { error: "You can only assign assessments to your own reports" };
  if (!employee.current_role_id) return { error: "This person has no role in Job Architecture yet. Assign a role first." };

  const settings = await getAssessmentSettings(orgId);
  if (route === "self" && !settings.selfStartAllowed) return { error: "Your company has not switched on self-started assessments" };

  // Retake interval.
  if (settings.retakeIntervalDays > 0) {
    const { data: last } = await supabase
      .from("competency_assessments")
      .select("created_at")
      .eq("employee_user_id", employeeUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ created_at: string }>();
    if (last && Date.now() - new Date(last.created_at).getTime() < settings.retakeIntervalDays * 86400000) {
      return { error: `An assessment was already made in the last ${settings.retakeIntervalDays} days` };
    }
  }

  const { data: role } = await supabase
    .from("job_roles")
    .select("id, title, level")
    .eq("id", employee.current_role_id)
    .eq("organization_id", orgId)
    .maybeSingle<{ id: string; title: string; level: string }>();
  if (!role) return { error: "The person's role could not be found" };

  const { data: reqRows, error: reqError } = await supabase
    .from("role_competency_requirements")
    .select("dimension, competency_id, target_level")
    .eq("role_id", role.id)
    .gt("target_level", 0)
    .returns<{ dimension: string | null; competency_id: string | null; target_level: number }[]>();
  if (reqError) return { error: "Could not read the role's required competencies. The database may need migration 0203 run first." };

  const requirements: Requirement[] = [];
  for (const r of reqRows ?? []) {
    if (r.competency_id) requirements.push({ key: r.competency_id, kind: "company", target: r.target_level });
    else if (r.dimension && isStandardDimension(r.dimension)) requirements.push({ key: r.dimension, kind: "standard", target: r.target_level });
  }
  if (requirements.length === 0) return { error: "This role has no required competencies yet. Add them in Job Architecture." };
  requirements.sort((a, b) => b.target - a.target);
  const chosen = requirements.slice(0, settings.maxCompetencies);
  const leftOut = requirements.length - chosen.length;

  // Language: the person's own, falling back to ours.
  const { data: profile } = await supabase.from("profiles").select("language").eq("id", employeeUserId).maybeSingle<{ language: string | null }>();
  const language: AssessmentLanguage = isAssessmentLanguage(profile?.language) ? profile.language : ((await resolveCallerLocale(supabase, ctx.userId)) as AssessmentLanguage);

  const budget = await assertAiBudgetOk(supabase, { organizationId: orgId, userId: ctx.userId });
  if (budget.error) return { error: budget.error };

  // Company competencies' wording.
  const companyIds = chosen.filter((c) => c.kind === "company").map((c) => c.key);
  const companyById = new Map<string, CompanyCompetencyRow>();
  if (companyIds.length) {
    const { data } = await supabase
      .from("organization_competencies")
      .select("id, name, description, category, level_indicators")
      .in("id", companyIds)
      .returns<CompanyCompetencyRow[]>();
    for (const c of data ?? []) companyById.set(c.id, c);
  }

  // Freeze each definition, then make sure its questions exist.
  const usages: Usage[] = [];
  let built: { req: Requirement; versionId: string; band: number; items: { id: string; position: number }[] }[];
  try {
    built = await Promise.all(
      chosen.map(async (req) => {
        let definition: DefinitionText;
        let style: ItemStyle;
        let versionId: string | null = null;
        if (req.kind === "standard") {
          const dim = req.key as (typeof COMPETENCY_DIMENSIONS)[number];
          definition = standardDefinitionText(dim, language);
          style = standardItemStyle(dim);
          const { data } = await supabase.rpc("record_competency_definition_version", {
            p_organization_id: orgId,
            p_kind: "standard",
            p_competency_key: dim,
            p_language: language,
            p_name: definition.name,
            p_description: definition.description,
            p_level_indicators: definition.levels,
            p_wording_version: STANDARD_WORDING_VERSION,
          });
          versionId = (data as string | null) ?? null;
        } else {
          const c = companyById.get(req.key);
          if (!c) throw new Error("A required company competency no longer exists");
          definition = { name: c.name, description: c.description ?? "", levels: c.level_indicators ?? {} };
          style = companyItemStyle(c.category);
          const { data } = await supabase.rpc("record_competency_definition_version", {
            p_organization_id: orgId,
            p_kind: "company",
            p_competency_key: c.id,
            p_language: null,
            p_name: c.name,
            p_description: c.description,
            p_level_indicators: c.level_indicators ?? {},
            p_wording_version: null,
          });
          versionId = (data as string | null) ?? null;
        }
        if (!versionId) throw new Error("Could not save the competency wording");
        const band = proficiencyLevel(req.target) ?? 1;
        const { items, usage } = await ensureItems(supabase, { organizationId: orgId, versionId, band, language, count: settings.itemsPerCompetency, definition, style, roleTitle: role.title });
        if (usage) usages.push(usage);
        return { req, versionId, band, items };
      })
    );
  } catch (err) {
    console.error("createAssessment preparation failed:", err);
    for (const u of usages) await recordAiUsage(supabase, { organizationId: orgId, userId: ctx.userId, feature: "assessment_questions", model: u.model, inputTokens: u.inputTokens, outputTokens: u.outputTokens });
    return { error: "Could not prepare the questions right now. Try again in a minute." };
  }
  for (const u of usages) await recordAiUsage(supabase, { organizationId: orgId, userId: ctx.userId, feature: "assessment_questions", model: u.model, inputTokens: u.inputTokens, outputTokens: u.outputTokens });

  const { data: assessment, error: insertError } = await supabase
    .from("competency_assessments")
    .insert({
      organization_id: orgId,
      employee_user_id: employeeUserId,
      role_id: role.id,
      role_title: role.title,
      role_level: role.level ?? "",
      route,
      assigned_by: route === "assigned" ? ctx.userId : null,
      language,
      items_per_competency: settings.itemsPerCompetency,
      method_version: SCORING_METHOD_VERSION,
      required_snapshot: built.map((b) => ({ competency_key: b.req.key, kind: b.req.kind, definition_version_id: b.versionId, required_target: b.req.target, required_level: b.band })),
    })
    .select("id")
    .single<{ id: string }>();
  if (insertError || !assessment) {
    console.error("createAssessment insert failed:", insertError);
    return { error: "Could not create the assessment. The database may need migration 0204 run first." };
  }
  const responseRows = built.flatMap((b) => b.items.map((it) => ({ organization_id: orgId, assessment_id: assessment.id, employee_user_id: employeeUserId, item_id: it.id })));
  const { error: respError } = await supabase.from("competency_assessment_responses").insert(responseRows);
  if (respError) {
    console.error("createAssessment responses failed:", respError);
    await supabase.from("competency_assessments").delete().eq("id", assessment.id);
    return { error: "Could not create the assessment's questions. Try again." };
  }
  revalidate();
  // Tell the person, with the details, when someone else assigned it. Best effort: a failed email never undoes the assignment.
  const emailed =
    route === "assigned"
      ? await sendAssessmentAssignedEmail(supabase, {
          organizationId: orgId,
          employeeUserId,
          assignerUserId: ctx.userId,
          roleTitle: role.title,
          language,
          detail: { kind: "role", competencyCount: built.length, questionsPerCompetency: settings.itemsPerCompetency, retentionMonths: settings.retentionMonths, assessmentId: assessment.id },
        })
      : null;
  return { success: true as const, assessmentId: assessment.id, leftOut, emailed };
}

export async function assignRoleAssessment(employeeUserId: string) {
  const ctx = await context();
  if ("error" in ctx) return { error: ctx.error };
  return createAssessment(ctx, employeeUserId, "assigned");
}

export async function startMyRoleAssessment() {
  const ctx = await context();
  if ("error" in ctx) return { error: ctx.error };
  return createAssessment(ctx, ctx.userId, "self");
}

// ---------------------------------------------------------------------------------------------------------------
// Reading

export async function listMyRoleAssessments(): Promise<RoleAssessmentRow[]> {
  const ctx = await context();
  if ("error" in ctx) return [];
  return listRows(ctx.supabase, { only: ctx.userId });
}

// For a manager (their reports) or an admin (everyone): row level security decides what comes back.
export async function listManagedRoleAssessments(): Promise<{ rows: RoleAssessmentRow[]; names: Record<string, string>; employees: AssignableEmployee[]; roles: PickerRole[]; viewer: "admin" | "manager"; settings: AssessmentSettings } | { error: string }> {
  const ctx = await context();
  if ("error" in ctx) return { error: ctx.error };
  const isAdmin = ctx.member.role === "admin";
  const rows = await listRows(ctx.supabase, isAdmin ? {} : { except: ctx.userId });

  const memberQuery = ctx.supabase.from("organization_members").select("user_id").eq("organization_id", ctx.member.organization_id);
  const { data: members } = await (isAdmin ? memberQuery : memberQuery.eq("manager_user_id", ctx.userId)).returns<{ user_id: string }[]>();
  // An admin who is also an employee is listed too, so she can be assessed like anyone else.
  const ids = (members ?? []).map((m) => m.user_id).filter((id) => isAdmin || id !== ctx.userId);
  const { data: profiles } = ids.length
    ? await ctx.supabase.from("profiles").select("id, full_name, email").in("id", ids).returns<{ id: string; full_name: string | null; email: string }[]>()
    : { data: [] as { id: string; full_name: string | null; email: string }[] };
  const settings = await getAssessmentSettings(ctx.member.organization_id);

  // Show up front who cannot be assessed (no role yet) or not yet again (retake interval), instead of failing after Assign.
  const picker = await pickerInfo(ctx.supabase, ctx.member.organization_id, ids);
  const roleTitles = picker.roleTitles;
  const lastByEmployee = new Map<string, string>();
  if (settings.retakeIntervalDays > 0 && ids.length > 0) {
    const { data: last } = await ctx.supabase
      .from("competency_assessments")
      .select("employee_user_id, created_at")
      .in("employee_user_id", ids)
      .order("created_at", { ascending: false })
      .limit(1000)
      .returns<{ employee_user_id: string; created_at: string }[]>();
    for (const l of last ?? []) if (!lastByEmployee.has(l.employee_user_id)) lastByEmployee.set(l.employee_user_id, l.created_at);
  }
  const employees = (profiles ?? [])
    .map((p) => ({
      userId: p.id,
      name: p.full_name?.trim() || p.email,
      email: p.email,
      isSelf: p.id === ctx.userId,
      memberId: picker.memberIds.get(p.id) ?? null,
      roleTitle: roleTitles.get(p.id) ?? null,
      availableOn: availableOn(lastByEmployee.get(p.id), settings.retakeIntervalDays),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const names = Object.fromEntries(employees.map((e) => [e.userId, e.name]));
  return { rows, names, employees, roles: picker.roles, viewer: isAdmin ? "admin" : "manager", settings };
}

async function listRows(supabase: Supabase, only: { only?: string; except?: string }): Promise<RoleAssessmentRow[]> {
  let query = supabase
    .from("competency_assessments")
    .select("id, employee_user_id, role_title, status, route, language, created_at, submitted_at, scored_at, required_snapshot")
    .order("created_at", { ascending: false })
    .limit(200);
  if (only.only) query = query.eq("employee_user_id", only.only);
  if (only.except) query = query.neq("employee_user_id", only.except);
  const { data, error } = await query;
  if (error || !data) return [];
  return (data as { id: string; employee_user_id: string; role_title: string; status: RoleAssessmentRow["status"]; route: "assigned" | "self"; language: "en" | "ar"; created_at: string; submitted_at: string | null; scored_at: string | null; required_snapshot: unknown[] }[]).map((a) => ({
    id: a.id,
    employeeUserId: a.employee_user_id,
    roleTitle: a.role_title,
    status: a.status,
    route: a.route,
    language: a.language,
    createdAt: a.created_at,
    submittedAt: a.submitted_at,
    scoredAt: a.scored_at,
    competencyCount: Array.isArray(a.required_snapshot) ? a.required_snapshot.length : 0,
  }));
}

export async function getRoleAssessment(assessmentId: string): Promise<RoleAssessmentView | { error: string }> {
  const ctx = await context();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;

  const { data: a } = await supabase
    .from("competency_assessments")
    .select("id, organization_id, employee_user_id, role_title, role_level, status, route, language, created_at, submitted_at, scored_at, method_version, required_snapshot")
    .eq("id", assessmentId)
    .maybeSingle<{ id: string; organization_id: string; employee_user_id: string; role_title: string; role_level: string; status: RoleAssessmentView["status"]; route: "assigned" | "self"; language: "en" | "ar"; created_at: string; submitted_at: string | null; scored_at: string | null; method_version: string; required_snapshot: { competency_key: string; kind: "standard" | "company"; definition_version_id: string; required_target: number | null; required_level: number | null }[] }>();
  if (!a) return { error: "Assessment not found" };

  const snapshot = Array.isArray(a.required_snapshot) ? a.required_snapshot : [];
  const versionIds = snapshot.map((s) => s.definition_version_id);
  const [{ data: versions }, { data: responses }, { data: results }, { data: profile }] = await Promise.all([
    supabase.from("competency_definition_versions").select("id, name, description, level_indicators").in("id", versionIds).returns<{ id: string; name: string; description: string | null; level_indicators: Record<string, string> }[]>(),
    supabase
      .from("competency_assessment_responses")
      .select("item_id, response_text, purged_at, competency_assessment_items(id, definition_version_id, position, prompt)")
      .eq("assessment_id", assessmentId)
      .returns<{ item_id: string; response_text: string | null; purged_at: string | null; competency_assessment_items: { id: string; definition_version_id: string; position: number; prompt: string } | null }[]>(),
    supabase.from("competency_assessment_results").select("*").eq("assessment_id", assessmentId),
    supabase.from("profiles").select("full_name, email").eq("id", a.employee_user_id).maybeSingle<{ full_name: string | null; email: string }>(),
  ]);

  const versionById = new Map((versions ?? []).map((v) => [v.id, v]));
  const resultByVersion = new Map<string, Record<string, unknown>>();
  for (const r of results ?? []) resultByVersion.set((r as { definition_version_id: string }).definition_version_id, r as Record<string, unknown>);

  const entries: CompetencyEntry[] = snapshot.map((s) => {
    const v = versionById.get(s.definition_version_id);
    const items = (responses ?? [])
      .filter((r) => r.competency_assessment_items?.definition_version_id === s.definition_version_id)
      .map((r) => ({ itemId: r.item_id, position: r.competency_assessment_items!.position, prompt: r.competency_assessment_items!.prompt, answer: r.response_text, purged: !!r.purged_at }))
      .sort((x, y) => x.position - y.position);
    const raw = resultByVersion.get(s.definition_version_id);
    const result: ResultView | null = raw
      ? {
          id: raw.id as string,
          status: raw.status as ResultView["status"],
          notAssessedReason: (raw.not_assessed_reason as ResultView["notAssessedReason"]) ?? null,
          level: (raw.level as number | null) ?? null,
          rangeLow: (raw.range_low as number | null) ?? null,
          rangeHigh: (raw.range_high as number | null) ?? null,
          score: (raw.score as number | null) ?? null,
          scoreLow: (raw.score_low as number | null) ?? null,
          scoreHigh: (raw.score_high as number | null) ?? null,
          confidence: (raw.confidence as ResultView["confidence"]) ?? null,
          confidenceReasons: (raw.confidence_reasons as string[]) ?? [],
          evidenceQuotes: (raw.evidence_quotes as ResultView["evidenceQuotes"]) ?? [],
          rationale: (raw.rationale as string | null) ?? null,
          nextLevelGap: (raw.next_level_gap as string | null) ?? null,
          judgements: (raw.judgements as number) ?? 2,
          confirmedBy: (raw.confirmed_by as string | null) ?? null,
          confirmedAt: (raw.confirmed_at as string | null) ?? null,
          overrideLevel: (raw.override_level as number | null) ?? null,
          overrideReason: (raw.override_reason as string | null) ?? null,
        }
      : null;
    return {
      competencyKey: s.competency_key,
      kind: s.kind,
      versionId: s.definition_version_id,
      name: v?.name ?? s.competency_key,
      description: v?.description ?? "",
      levels: v?.level_indicators ?? {},
      requiredTarget: s.required_target,
      requiredLevel: s.required_level,
      items,
      result,
    };
  });

  let viewer: RoleAssessmentView["viewer"] = "employee";
  if (a.employee_user_id !== userId) viewer = ctx.member.role === "admin" ? "admin" : "manager";
  return {
    id: a.id,
    employeeUserId: a.employee_user_id,
    employeeName: profile?.full_name?.trim() || profile?.email || null,
    roleTitle: a.role_title,
    roleLevel: a.role_level,
    status: a.status,
    route: a.route,
    language: a.language,
    createdAt: a.created_at,
    submittedAt: a.submitted_at,
    scoredAt: a.scored_at,
    methodVersion: a.method_version,
    viewer,
    entries,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Answering and scoring

export async function saveRoleAssessmentAnswers(assessmentId: string, answers: { itemId: string; text: string }[]) {
  const ctx = await context();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId } = ctx;
  const { data: a } = await supabase.from("competency_assessments").select("id, employee_user_id, status").eq("id", assessmentId).maybeSingle<{ id: string; employee_user_id: string; status: string }>();
  if (!a) return { error: "Assessment not found" };
  if (a.employee_user_id !== userId) return { error: "Only the person being assessed can write the answers" };
  if (a.status !== "assigned" && a.status !== "in_progress") return { error: "This assessment is already submitted" };

  // All answers are saved at once. A dropped connection is retried once before giving up.
  const saveOne = async (ans: { itemId: string; text: string }) => {
    const text = String(ans.text ?? "").slice(0, MAX_ANSWER);
    for (let attempt = 0; attempt < 2; attempt++) {
      const { error } = await supabase.from("competency_assessment_responses").update({ response_text: text }).eq("assessment_id", assessmentId).eq("item_id", ans.itemId);
      if (!error) return null;
      if (attempt === 1 || !/fetch failed|ECONNRESET|network/i.test(`${error.message} ${error.details ?? ""}`)) return error;
    }
    return null;
  };
  const failures = (await Promise.all(answers.map(saveOne))).filter(Boolean);
  if (failures.length > 0) {
    console.error("saveRoleAssessmentAnswers failed:", failures[0]);
    return { error: "Could not save your answers. Try again." };
  }
  if (a.status === "assigned") {
    await supabase.from("competency_assessments").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", assessmentId);
  }
  return { success: true };
}

export async function submitRoleAssessment(assessmentId: string, answers: { itemId: string; text: string }[]) {
  const saved = await saveRoleAssessmentAnswers(assessmentId, answers);
  if ("error" in saved) return saved;
  const ctx = await context();
  if ("error" in ctx) return { error: ctx.error };
  const now = new Date().toISOString();
  await ctx.supabase.from("competency_assessment_responses").update({ submitted_at: now }).eq("assessment_id", assessmentId).not("response_text", "is", null);
  const { error } = await ctx.supabase.from("competency_assessments").update({ status: "submitted", submitted_at: now }).eq("id", assessmentId);
  if (error) {
    console.error("submitRoleAssessment failed:", error);
    return { error: "Could not submit. Try again." };
  }
  revalidate();
  return { success: true };
}

// Scores ONE competency of a submitted assessment (the screen calls this for each competency in turn, so progress is
// visible and a failure can be retried on its own). The person being assessed, their manager or an admin may call it.
export async function scoreRoleAssessmentCompetency(assessmentId: string, versionId: string) {
  const ctx = await context();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, userId, member } = ctx;

  const { data: a } = await supabase
    .from("competency_assessments")
    .select("id, organization_id, employee_user_id, role_title, status, language, required_snapshot")
    .eq("id", assessmentId)
    .maybeSingle<{ id: string; organization_id: string; employee_user_id: string; role_title: string; status: string; language: "en" | "ar"; required_snapshot: { competency_key: string; kind: "standard" | "company"; definition_version_id: string; required_target: number | null; required_level: number | null }[] }>();
  if (!a) return { error: "Assessment not found" };
  if (!["submitted", "scored", "scoring_failed"].includes(a.status)) return { error: "Submit the assessment first" };
  const entry = (a.required_snapshot ?? []).find((s) => s.definition_version_id === versionId);
  if (!entry) return { error: "That competency is not part of this assessment" };

  // A result that is already scored or not assessed is final; only a failed one is run again.
  const { data: existing } = await supabase.from("competency_assessment_results").select("id, status").eq("assessment_id", assessmentId).eq("definition_version_id", versionId).maybeSingle<{ id: string; status: string }>();
  if (existing && existing.status !== "scoring_failed") return { success: true, status: existing.status };

  const budget = await assertAiBudgetOk(supabase, { organizationId: a.organization_id, userId });
  if (budget.error) return { error: budget.error };

  const { data: version } = await supabase.from("competency_definition_versions").select("name, description, level_indicators, kind").eq("id", versionId).maybeSingle<{ name: string; description: string | null; level_indicators: Record<string, string>; kind: string }>();
  const { data: responses } = await supabase
    .from("competency_assessment_responses")
    .select("response_text, competency_assessment_items(definition_version_id, position, prompt)")
    .eq("assessment_id", assessmentId)
    .returns<{ response_text: string | null; competency_assessment_items: { definition_version_id: string; position: number; prompt: string } | null }[]>();
  if (!version || !responses) return { error: "Could not read the competency or the answers" };
  const items = responses
    .filter((r) => r.competency_assessment_items?.definition_version_id === versionId)
    .map((r) => ({ position: r.competency_assessment_items!.position, prompt: r.competency_assessment_items!.prompt, answer: r.response_text ?? "" }))
    .sort((x, y) => x.position - y.position);

  const scoring = await scoreCompetency({
    definition: { name: version.name, description: version.description ?? "", levels: version.level_indicators ?? {} },
    type: entry.kind === "company" ? "company competency" : "standard competency",
    roleTitle: a.role_title,
    language: a.language,
    questions: items.map((i) => i.prompt),
    answers: items.map((i) => i.answer),
  });
  for (const u of scoring.usages) await recordAiUsage(supabase, { organizationId: a.organization_id, userId, feature: "assessment_scoring", model: u.model, inputTokens: u.inputTokens, outputTokens: u.outputTokens });

  const r = scoring.result;
  const row: Record<string, unknown> = {
    organization_id: a.organization_id,
    assessment_id: assessmentId,
    employee_user_id: a.employee_user_id,
    definition_version_id: versionId,
    competency_key: entry.competency_key,
    required_target: entry.required_target,
    required_level: entry.required_level,
    status: r.status,
    method_version: SCORING_METHOD_VERSION,
    judgements: scoring.judgements,
    model: scoring.usages[0]?.model ?? null,
    scored_at: new Date().toISOString(),
    confidence_reasons: scoring.confidenceReasons,
    evidence_quotes: scoring.quotes,
    rationale: scoring.rationale,
    next_level_gap: scoring.nextLevelGap,
    not_assessed_reason: r.status === "not_assessed" ? r.reason : null,
    level: null,
    range_low: null,
    range_high: null,
    score: null,
    score_low: null,
    score_high: null,
    confidence: null,
  };
  if (r.status === "scored") {
    Object.assign(row, { level: r.level, range_low: r.rangeLow, range_high: r.rangeHigh, score: r.score, score_low: r.scoreLow, score_high: r.scoreHigh, confidence: scoring.confidence, evidence_levels: r.evidence });
  }
  const write = existing
    ? await supabase.from("competency_assessment_results").update(row).eq("id", existing.id)
    : await supabase.from("competency_assessment_results").insert(row);
  if (write.error) {
    console.error("scoreRoleAssessmentCompetency write failed:", write.error);
    return { error: "Could not save the result. Try again." };
  }

  // When every competency has a result, close the assessment.
  const { data: all } = await supabase.from("competency_assessment_results").select("status").eq("assessment_id", assessmentId).returns<{ status: string }[]>();
  if ((all?.length ?? 0) >= (a.required_snapshot?.length ?? 0) && a.status !== "scored") {
    const anyOk = (all ?? []).some((x) => x.status !== "scoring_failed");
    await supabase.from("competency_assessments").update({ status: anyOk ? "scored" : "scoring_failed", scored_at: new Date().toISOString() }).eq("id", assessmentId);
  }
  void member;
  revalidate();
  return { success: true, status: r.status };
}

// ---------------------------------------------------------------------------------------------------------------
// A person confirms or overrides a result. Only the manager or an admin; an override needs a reason.

export async function confirmRoleResult(resultId: string, input: { overrideLevel?: number | null; reason?: string }) {
  const ctx = await context();
  if ("error" in ctx) return { error: ctx.error };
  const override = input.overrideLevel ?? null;
  const reason = (input.reason ?? "").trim().slice(0, 1000);
  if (override !== null && (!Number.isInteger(override) || override < 1 || override > 5)) return { error: "Choose a level from 1 to 5" };
  if (override !== null && !reason) return { error: "Say why you are changing the level" };
  const { data, error } = await ctx.supabase
    .from("competency_assessment_results")
    .update({ confirmed_by: ctx.userId, confirmed_at: new Date().toISOString(), override_level: override, override_reason: override !== null ? reason : null })
    .eq("id", resultId)
    .select("id")
    .returns<{ id: string }[]>();
  if (error || !data || data.length === 0) return { error: "You cannot confirm this result" };
  revalidate();
  return { success: true };
}

export async function purgeExpiredRoleAssessmentAnswers() {
  const ctx = await context();
  if ("error" in ctx) return 0;
  const { data } = await ctx.supabase.rpc("purge_expired_competency_assessment_answers", { p_organization_id: ctx.member.organization_id });
  return typeof data === "number" ? data : 0;
}
