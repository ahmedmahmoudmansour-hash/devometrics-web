"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/jobArchitecture/actions";
import { listMyRestrictedFeatures } from "@/lib/organizations/featureAccess";
import { cleanLevelIndicators } from "@/lib/proficiency/library";
import enMessages from "@/messages/en.json";
import arMessages from "@/messages/ar.json";
import { dimensionLabel } from "@/lib/gap-analysis/dimensions";
import { JOB_BANK } from "./index";
import { isBankLanguage, localizeBank, type BankLanguage } from "./localize";
import { planImport, requirementRows, type Selection } from "./plan";
import { summariseBank, type BankSummaryFamily } from "./summary";

export type ImportReport = {
  familiesCreated: number;
  familiesExisting: number;
  competenciesCreated: number;
  competenciesExisting: number;
  rolesCreated: number;
  rolesExisting: number;
};

const MAX_ROLES_PER_IMPORT = 80;

const DIMENSION_LABELS: Record<BankLanguage, Record<string, string>> = {
  en: (enMessages as unknown as { competencyDimensions: Record<string, string> }).competencyDimensions,
  ar: (arMessages as unknown as { competencyDimensions: Record<string, string> }).competencyDimensions,
};

// The bank as the Job bank screen shows it, in the chosen language. Static content, but only company admins can ask for it.
export async function getBankSummary(language: BankLanguage): Promise<{ error: string } | { bank: BankSummaryFamily[] }> {
  const { user, organizationId } = await requireAdmin();
  if (!user || !organizationId) return { error: "Not authorized" };
  if (!isBankLanguage(language)) return { error: "Unknown language" };
  const labels = DIMENSION_LABELS[language];
  return { bank: summariseBank(localizeBank(JOB_BANK, language), (dim) => dimensionLabel((key) => labels[key] ?? key, dim)) };
}

// Adds starter job families, roles and competencies from the bank to the caller's own company. Runs as the signed-in
// admin, so every database rule (company isolation, admin-only writes) applies exactly as for a manual add. Safe to
// run again: anything the company already has is kept as it is and never overwritten.
export async function importFromJobBank(selection: Selection, language: BankLanguage = "en"): Promise<{ error: string } | { success: true; report: ImportReport }> {
  const { supabase, user, organizationId } = await requireAdmin();
  if (!user || !organizationId) return { error: "Not authorized" };
  if (!isBankLanguage(language)) return { error: "Unknown language" };
  // The words come from the chosen language; the structure (keys, grades, requirements) is the same in both.
  const bank = localizeBank(JOB_BANK, language);

  const restricted = await listMyRestrictedFeatures(supabase, organizationId);
  if (restricted.has("competency_management")) return { error: "Competency Management has been restricted for your account by your company administrator." };

  const chosen = (Array.isArray(selection) ? selection : []).filter((s) => s && typeof s.familyKey === "string" && Array.isArray(s.roleKeys));
  const roleCount = chosen.reduce((n, s) => n + s.roleKeys.length, 0);
  if (roleCount === 0) return { error: "Choose at least one role" };
  if (roleCount > MAX_ROLES_PER_IMPORT) return { error: `Choose at most ${MAX_ROLES_PER_IMPORT} roles at a time` };

  // What the company already has.
  const [{ data: famRows, error: famErr }, { data: compRows, error: compErr }, { data: roleRows, error: roleErr }] = await Promise.all([
    supabase.from("job_families").select("id, name").eq("organization_id", organizationId).returns<{ id: string; name: string }[]>(),
    supabase.from("organization_competencies").select("id, name").eq("organization_id", organizationId).returns<{ id: string; name: string }[]>(),
    supabase.from("job_roles").select("id, title, job_family_id").eq("organization_id", organizationId).returns<{ id: string; title: string; job_family_id: string }[]>(),
  ]);
  if (famErr || compErr || roleErr) return { error: "Could not read your Job Architecture. The database may need migrations 0067 and 0203 run first." };

  const famById = new Map((famRows ?? []).map((f) => [f.id, f.name.trim().toLowerCase()]));
  const rolesByFamily: Record<string, string[]> = {};
  for (const r of roleRows ?? []) {
    const fname = famById.get(r.job_family_id);
    if (fname) (rolesByFamily[fname] ??= []).push(r.title);
  }

  const plan = planImport(bank, chosen, {
    familyNames: (famRows ?? []).map((f) => f.name),
    competencyNames: (compRows ?? []).map((c) => c.name),
    rolesByFamily,
  });
  if (plan.unknown.length > 0) return { error: "Something you chose is not in the job bank" };

  // 1. Families.
  const familyIdByName = new Map<string, string>((famRows ?? []).map((f) => [f.name.trim().toLowerCase(), f.id]));
  if (plan.familiesToCreate.length > 0) {
    const { data, error } = await supabase
      .from("job_families")
      .insert(plan.familiesToCreate.map((f) => ({ organization_id: organizationId, name: f.name, description: f.description, created_by: user.id })))
      .select("id, name")
      .returns<{ id: string; name: string }[]>();
    if (error || !data) {
      console.error("importFromJobBank families failed:", error);
      return { error: "Could not add the job families. Nothing else was added; try again." };
    }
    for (const f of data) familyIdByName.set(f.name.trim().toLowerCase(), f.id);
  }

  // 2. Competencies (the ones the chosen roles need and the company does not have yet).
  const competencyIdByName = new Map<string, string>((compRows ?? []).map((c) => [c.name.trim().toLowerCase(), c.id]));
  if (plan.competenciesToCreate.length > 0) {
    const { data, error } = await supabase
      .from("organization_competencies")
      .insert(
        plan.competenciesToCreate.map((c) => ({
          organization_id: organizationId,
          name: c.name,
          description: c.description,
          mapped_dimension: null,
          category: c.category,
          level_indicators: cleanLevelIndicators(Object.fromEntries(c.levels.map((t, i) => [String(i + 1), t]))),
        }))
      )
      .select("id, name")
      .returns<{ id: string; name: string }[]>();
    if (error || !data) {
      console.error("importFromJobBank competencies failed:", error);
      return { error: "Added the job families but could not add the competencies. Run the import again to finish." };
    }
    for (const c of data) competencyIdByName.set(c.name.trim().toLowerCase(), c.id);
  }

  // 3. Roles, then their requirements.
  const familyByKey = new Map(bank.map((f) => [f.key, f]));
  let rolesCreated = 0;
  if (plan.rolesToCreate.length > 0) {
    const toInsert = plan.rolesToCreate.map(({ familyKey, role }) => ({
      organization_id: organizationId,
      job_family_id: familyIdByName.get(familyByKey.get(familyKey)!.name.trim().toLowerCase()),
      title: role.title,
      level: role.level,
      grade: role.grade,
      track: role.track,
      responsibilities: role.responsibilities,
      created_by: user.id,
    }));
    if (toInsert.some((r) => !r.job_family_id)) return { error: "A job family could not be found after it was added. Run the import again." };
    const { data, error } = await supabase.from("job_roles").insert(toInsert).select("id, title, job_family_id").returns<{ id: string; title: string; job_family_id: string }[]>();
    if (error || !data) {
      console.error("importFromJobBank roles failed:", error);
      return { error: "Added families and competencies but could not add the roles. Run the import again to finish." };
    }
    rolesCreated = data.length;

    const idByFamilyAndTitle = new Map(data.map((r) => [`${r.job_family_id}|${r.title.toLowerCase()}`, r.id]));
    const reqRows: { organization_id: string; role_id: string; dimension?: string; competency_id?: string; target_level: number }[] = [];
    for (const { familyKey, role } of plan.rolesToCreate) {
      const fam = familyByKey.get(familyKey)!;
      const famId = familyIdByName.get(fam.name.trim().toLowerCase())!;
      const roleId = idByFamilyAndTitle.get(`${famId}|${role.title.toLowerCase()}`);
      if (!roleId) continue;
      const idByKey = new Map<string, string>();
      for (const c of fam.competencies) {
        const id = competencyIdByName.get(c.name.trim().toLowerCase());
        if (id) idByKey.set(c.key, id);
      }
      for (const row of requirementRows(role, idByKey, fam.competencies.map((c) => c.key))) {
        reqRows.push({ organization_id: organizationId, role_id: roleId, target_level: row.targetLevel, ...(row.competencyId ? { competency_id: row.competencyId } : { dimension: row.dimension }) });
      }
    }
    if (reqRows.length > 0) {
      const { error: reqError } = await supabase.from("role_competency_requirements").insert(reqRows);
      if (reqError) {
        console.error("importFromJobBank requirements failed:", reqError);
        return { error: "Added the roles but could not add what each role requires. Open the roles and set the competencies, or ask us for help." };
      }
    }
  }

  revalidatePath("/dashboard/company/job-architecture");
  return {
    success: true,
    report: {
      familiesCreated: plan.familiesToCreate.length,
      familiesExisting: plan.familiesExisting.length,
      competenciesCreated: plan.competenciesToCreate.length,
      competenciesExisting: plan.competenciesExisting.length,
      rolesCreated,
      rolesExisting: plan.rolesExisting.length,
    },
  };
}
