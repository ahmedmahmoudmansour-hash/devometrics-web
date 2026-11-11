"use server";

// Knowledge checks: assign, answer, submit, read. Database rules (who can see and change what) live in migration 0207 and
// hold even if these actions are bypassed; the checks here give friendlier errors early. The answer key never leaves the
// server: a person is shown shuffled options only, and their choices are marked here against the question bank.

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveCallerLocale } from "@/lib/i18n/request";
import { proficiencyLevel } from "@/lib/proficiency/levels";
import { isAssessmentLanguage } from "@/lib/assessment/definitions";
import { pickerInfo, type PickerRole } from "@/lib/assessment/employeePicker";
import { isLate, limitSeconds, readMeta, withMeta } from "./timer";
import { KNOWLEDGE_BANK_VERSION, isAvailable } from "./index";
import { bankKeyForName, originalIndex, selectQuestions, type KnowledgeLanguage } from "./engine";
import { buildResultView, buildTakeView, scoreRow, type CheckRow, type ResultView, type TakeView } from "./view";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Member = { organization_id: string; role: "admin" | "member"; current_role_id: string | null; manager_user_id: string | null };

const MIGRATION_MESSAGE = "Knowledge checks need migration 0207 to be run in the database first.";
const COLUMNS = "id, employee_user_id, role_title, language, bank_version, seed, question_ids, required_levels, answers, created_at, submitted_at";

// The table is missing until migration 0207 has been run.
function tableMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /knowledge_checks/.test(error.message ?? "") && /does not exist|schema cache/.test(error.message ?? "");
}

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
// Assigning

export async function assignKnowledgeCheck(employeeUserId: string): Promise<{ error: string } | { success: true; checkId: string; questions: number; leftOut: number; inEnglish: boolean }> {
  const ctx = await context();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, member, userId } = ctx;
  const orgId = member.organization_id;
  if (typeof employeeUserId !== "string") return { error: "Choose a person" };
  // A company admin who is also an employee may give themselves a check (migration 0209); nobody else may.
  if (employeeUserId === userId && member.role !== "admin") return { error: "Choose a person other than yourself" };

  const { data: employee } = await supabase
    .from("organization_members")
    .select("user_id, current_role_id, manager_user_id")
    .eq("organization_id", orgId)
    .eq("user_id", employeeUserId)
    .maybeSingle<{ user_id: string; current_role_id: string | null; manager_user_id: string | null }>();
  if (!employee) return { error: "That person is not in your company" };
  if (!(member.role === "admin" || employee.manager_user_id === userId)) return { error: "You can only assign knowledge checks to your own reports" };
  if (!employee.current_role_id) return { error: "This person has no role in Job Architecture yet. Assign a role first." };

  // One open check at a time.
  const open = await supabase.from("knowledge_checks").select("id").eq("employee_user_id", employeeUserId).is("submitted_at", null).limit(1);
  if (open.error) return { error: tableMissing(open.error) ? MIGRATION_MESSAGE : "Could not read knowledge checks" };
  if ((open.data ?? []).length > 0) return { error: "This person already has a knowledge check waiting to be taken" };

  const { data: role } = await supabase.from("job_roles").select("id, title").eq("id", employee.current_role_id).eq("organization_id", orgId).maybeSingle<{ id: string; title: string }>();
  if (!role) return { error: "The person's role could not be found" };

  // The role's requirements, matched to the bank by the competency's name.
  const { data: reqRows } = await supabase
    .from("role_competency_requirements")
    .select("competency_id, target_level")
    .eq("role_id", role.id)
    .not("competency_id", "is", null)
    .gt("target_level", 0)
    .returns<{ competency_id: string; target_level: number }[]>();
  const ids = [...new Set((reqRows ?? []).map((r) => r.competency_id))];
  const { data: comps } = ids.length
    ? await supabase.from("organization_competencies").select("id, name").in("id", ids).returns<{ id: string; name: string }[]>()
    : { data: [] as { id: string; name: string }[] };
  const nameById = new Map((comps ?? []).map((c) => [c.id, c.name]));
  const requirements: { competencyKey: string; level: number }[] = [];
  for (const r of reqRows ?? []) {
    const key = bankKeyForName(nameById.get(r.competency_id) ?? "");
    if (key) requirements.push({ competencyKey: key, level: proficiencyLevel(r.target_level) ?? 1 });
  }
  if (requirements.length === 0) return { error: "None of this role's competencies are in the knowledge bank. Add the role from the Job bank in Job Architecture first." };

  // Language: the person's own. If the bank has no Arabic for these competencies yet, use English rather than refuse.
  const { data: profile } = await supabase.from("profiles").select("language").eq("id", employeeUserId).maybeSingle<{ language: string | null }>();
  const wanted: KnowledgeLanguage = isAssessmentLanguage(profile?.language) ? profile.language : ((await resolveCallerLocale(supabase, userId)) as KnowledgeLanguage);
  let language: KnowledgeLanguage = wanted;
  let picked = selectQuestions(requirements, (id) => isAvailable(id, language));
  if (picked.ids.length === 0 && language !== "en") {
    language = "en";
    picked = selectQuestions(requirements, (id) => isAvailable(id, "en"));
  }
  if (picked.ids.length === 0) return { error: "There are no knowledge questions for this role's competencies yet" };

  const requiredLevels = Object.fromEntries(picked.chosen.map((c) => [c.competencyKey, c.requiredLevel]));
  const { data: created, error } = await supabase
    .from("knowledge_checks")
    .insert({
      organization_id: orgId,
      employee_user_id: employeeUserId,
      role_id: role.id,
      role_title: role.title,
      assigned_by: userId,
      language,
      bank_version: KNOWLEDGE_BANK_VERSION,
      seed: randomBytes(12).toString("hex"),
      question_ids: picked.ids,
      required_levels: requiredLevels,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !created) {
    console.error("assignKnowledgeCheck failed:", error);
    if (error?.code === "42501" && employeeUserId === userId) return { error: "Giving yourself a knowledge check needs the 0209 database update first." };
    return { error: tableMissing(error) ? MIGRATION_MESSAGE : "Could not create the knowledge check. Try again." };
  }
  revalidate();
  return { success: true, checkId: created.id, questions: picked.ids.length, leftOut: picked.leftOut.length, inEnglish: wanted !== language };
}

// ---------------------------------------------------------------------------------------------------------------
// Listing

export type KnowledgeCheckListRow = {
  id: string;
  employeeUserId: string;
  roleTitle: string;
  language: "en" | "ar";
  createdAt: string;
  submittedAt: string | null;
  questionCount: number;
  // Only for a submitted check.
  percent: number | null;
};

function toListRow(r: CheckRow): KnowledgeCheckListRow {
  return {
    id: r.id,
    employeeUserId: r.employee_user_id,
    roleTitle: r.role_title,
    language: r.language,
    createdAt: r.created_at,
    submittedAt: r.submitted_at,
    questionCount: r.question_ids.length,
    percent: r.submitted_at ? scoreRow(r).percent : null,
  };
}

export async function listMyKnowledgeChecks(): Promise<KnowledgeCheckListRow[]> {
  const ctx = await context();
  if ("error" in ctx) return [];
  const { data, error } = await ctx.supabase.from("knowledge_checks").select(COLUMNS).eq("employee_user_id", ctx.userId).order("created_at", { ascending: false }).limit(100).returns<CheckRow[]>();
  if (error || !data) return [];
  return data.map(toListRow);
}

// For a manager (their reports) or an admin (everyone): row level security decides what comes back.
export async function listManagedKnowledgeChecks(): Promise<
  { rows: KnowledgeCheckListRow[]; names: Record<string, string>; employees: { userId: string; name: string; memberId: string | null; roleTitle: string | null }[]; roles: PickerRole[]; isAdmin: boolean; ready: boolean } | { error: string }
> {
  const ctx = await context();
  if ("error" in ctx) return { error: ctx.error };
  const isAdmin = ctx.member.role === "admin";
  const query = ctx.supabase.from("knowledge_checks").select(COLUMNS).order("created_at", { ascending: false }).limit(200);
  const { data, error } = await (isAdmin ? query : query.neq("employee_user_id", ctx.userId)).returns<CheckRow[]>();
  const ready = !tableMissing(error);

  const memberQuery = ctx.supabase.from("organization_members").select("user_id").eq("organization_id", ctx.member.organization_id);
  const { data: members } = await (isAdmin ? memberQuery : memberQuery.eq("manager_user_id", ctx.userId)).returns<{ user_id: string }[]>();
  const ids = (members ?? []).map((m) => m.user_id).filter((id) => isAdmin || id !== ctx.userId);
  const { data: profiles } = ids.length
    ? await ctx.supabase.from("profiles").select("id, full_name, email").in("id", ids).returns<{ id: string; full_name: string | null; email: string }[]>()
    : { data: [] as { id: string; full_name: string | null; email: string }[] };
  const picker = await pickerInfo(ctx.supabase, ctx.member.organization_id, ids);
  const employees = (profiles ?? [])
    .map((p) => ({ userId: p.id, name: p.full_name?.trim() || p.email, memberId: picker.memberIds.get(p.id) ?? null, roleTitle: picker.roleTitles.get(p.id) ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { rows: (data ?? []).map(toListRow), names: Object.fromEntries(employees.map((e) => [e.userId, e.name])), employees, roles: picker.roles, isAdmin, ready };
}

// ---------------------------------------------------------------------------------------------------------------
// Taking and reading

// The clock starts the first time the person opens their check, and the server (not their device) says when. If it cannot be
// recorded the check still opens and the page falls back to its own clock.
async function ensureStarted(supabase: Awaited<ReturnType<typeof createClient>>, row: CheckRow): Promise<CheckRow> {
  if (readMeta(row.answers).startedAt !== undefined) return row;
  const next = withMeta(((row.answers ?? {}) as Record<string, number>), { ...readMeta(row.answers), startedAt: Date.now() });
  const { data, error } = await supabase.from("knowledge_checks").update({ answers: next }).eq("id", row.id).eq("employee_user_id", row.employee_user_id).is("submitted_at", null).select("id");
  if (error || !data || data.length === 0) return row;
  return { ...row, answers: next as CheckRow["answers"] };
}

// Called by the page each time the person comes back after leaving it (another tab or window). Shown to the manager.
export async function noteKnowledgeCheckLeftPage(checkId: string): Promise<{ success: true } | { error: string }> {
  const ctx = await context();
  if ("error" in ctx) return { error: ctx.error };
  const { data: row } = await ctx.supabase.from("knowledge_checks").select(COLUMNS).eq("id", checkId).eq("employee_user_id", ctx.userId).maybeSingle<CheckRow>();
  if (!row || row.submitted_at) return { error: "Not an open check" };
  const meta = readMeta(row.answers);
  const next = withMeta(((row.answers ?? {}) as Record<string, number>), { ...meta, leftPage: (meta.leftPage ?? 0) + 1 });
  const { error } = await ctx.supabase.from("knowledge_checks").update({ answers: next }).eq("id", checkId).eq("employee_user_id", ctx.userId).is("submitted_at", null);
  return error ? { error: "Could not record this" } : { success: true };
}

export type KnowledgeCheckPage =
  | { kind: "take"; view: TakeView }
  | { kind: "result"; view: ResultView; ownCheck: boolean; employeeName: string | null }
  | { kind: "pending"; roleTitle: string; employeeName: string | null }
  | { error: string };

export async function getKnowledgeCheck(checkId: string): Promise<KnowledgeCheckPage> {
  const ctx = await context();
  if ("error" in ctx) return { error: ctx.error };
  const { data: row, error } = await ctx.supabase.from("knowledge_checks").select(COLUMNS).eq("id", checkId).maybeSingle<CheckRow>();
  if (error) return { error: tableMissing(error) ? MIGRATION_MESSAGE : "Could not open this knowledge check" };
  if (!row) return { error: "This knowledge check was not found, or you do not have access to it" };

  const own = row.employee_user_id === ctx.userId;
  let employeeName: string | null = null;
  if (!own) {
    const { data: p } = await ctx.supabase.from("profiles").select("full_name, email").eq("id", row.employee_user_id).maybeSingle<{ full_name: string | null; email: string }>();
    employeeName = p ? p.full_name?.trim() || p.email : null;
  }
  if (!row.submitted_at && own) return { kind: "take", view: buildTakeView(await ensureStarted(ctx.supabase, row)) };
  if (!row.submitted_at) return { kind: "pending", roleTitle: row.role_title, employeeName };
  const view = buildResultView(row);
  if (!view) return { error: "Could not read this knowledge check" };
  return { kind: "result", view, ownCheck: own, employeeName };
}

export type AnswerInput = { id: string; choice: number | null };

// The person's choices, as the option position they saw, turned into the original option index that is stored.
function toStored(row: CheckRow, input: AnswerInput[]): { ok: true; answers: Record<string, number> } | { ok: false; error: string } {
  const allowed = new Set(row.question_ids);
  const out: Record<string, number> = {};
  for (const a of Array.isArray(input) ? input : []) {
    if (!a || typeof a.id !== "string" || !allowed.has(a.id)) return { ok: false, error: "An answer does not belong to this knowledge check" };
    if (a.choice === null || a.choice === undefined) continue;
    const original = originalIndex(row.seed, a.id, a.choice);
    if (original === null) return { ok: false, error: "An answer is not valid" };
    out[a.id] = original;
  }
  return { ok: true, answers: out };
}

async function writeAnswers(checkId: string, input: AnswerInput[], submit: boolean): Promise<{ error: string } | { success: true }> {
  const ctx = await context();
  if ("error" in ctx) return { error: ctx.error };
  const { data: row, error } = await ctx.supabase.from("knowledge_checks").select(COLUMNS).eq("id", checkId).eq("employee_user_id", ctx.userId).maybeSingle<CheckRow>();
  if (error) return { error: tableMissing(error) ? MIGRATION_MESSAGE : "Could not open this knowledge check" };
  if (!row) return { error: "This knowledge check was not found" };
  if (row.submitted_at) return { error: "This knowledge check has already been submitted" };
  const stored = toStored(row, input);
  if (!stored.ok) return { error: stored.error };
  const meta = readMeta(row.answers);
  if (submit && meta.startedAt !== undefined) meta.late = isLate(meta.startedAt, limitSeconds(row.question_ids.length), Date.now());
  const toWrite = withMeta(stored.answers, meta);
  const { data: updated, error: updateError } = await ctx.supabase
    .from("knowledge_checks")
    .update(submit ? { answers: toWrite, submitted_at: new Date().toISOString() } : { answers: toWrite })
    .eq("id", checkId)
    .eq("employee_user_id", ctx.userId)
    .is("submitted_at", null)
    .select("id");
  if (updateError || !updated || updated.length === 0) {
    console.error("knowledge check write failed:", updateError);
    return { error: "Could not save your answers. Try again." };
  }
  revalidate();
  return { success: true };
}

export async function saveKnowledgeCheckAnswers(checkId: string, answers: AnswerInput[]) {
  return writeAnswers(checkId, answers, false);
}

export async function submitKnowledgeCheck(checkId: string, answers: AnswerInput[]) {
  return writeAnswers(checkId, answers, true);
}
