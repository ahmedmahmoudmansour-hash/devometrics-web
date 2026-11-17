"use server";

// Uploading a company's own job titles and levels (an Excel or CSV file it keeps today). The browser only reads the file; the caller is
// re-checked here as a company admin, every row is re-validated with the same rules the preview used, and everything is written as the
// signed-in admin, so every database rule (company isolation, admin-only writes) applies exactly as for a manual add. Safe to run again:
// a role the company already has is skipped, never overwritten.

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/jobArchitecture/actions";
import { MAX_ROWS, keyOf, validateRoleRows, type RolesImportRow, type RolesValidation } from "./importCore";

export type RolesImportPreview = { error: string } | (Pick<RolesValidation, "results" | "ok" | "duplicates" | "errors" | "newFamilies">);
export type RolesImportResult = { error: string } | { success: true; rolesCreated: number; familiesCreated: number; skipped: number };

const CHUNK = 100;

// Whatever arrives from the browser is untrusted: make every field a plain string and cap the number of rows.
function clean(rows: unknown): RolesImportRow[] | null {
  if (!Array.isArray(rows)) return null;
  return rows.slice(0, MAX_ROWS + 1).map((r) => {
    const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    const s = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "");
    return { family: s(o.family), title: s(o.title), level: s(o.level), grade: s(o.grade), track: s(o.track), responsibilities: s(o.responsibilities) };
  });
}

async function validateAgainstCompany(rawRows: unknown) {
  const rows = clean(rawRows);
  if (!rows || rows.length === 0) return { ok: false, error: "The file has no data rows." } as const;
  if (rows.length > MAX_ROWS) return { ok: false, error: `Too many rows (more than ${MAX_ROWS}). Upload at most ${MAX_ROWS} at a time.` } as const;
  const { supabase, user, organizationId } = await requireAdmin();
  if (!user || !organizationId) return { ok: false, error: "Not authorized" } as const;

  const [{ data: famRows, error: famErr }, { data: roleRows, error: roleErr }] = await Promise.all([
    supabase.from("job_families").select("id, name").eq("organization_id", organizationId).returns<{ id: string; name: string }[]>(),
    supabase.from("job_roles").select("title, job_family_id").eq("organization_id", organizationId).returns<{ title: string; job_family_id: string }[]>(),
  ]);
  if (famErr || roleErr) return { ok: false, error: "Could not read your Job Architecture. The database may need migration 0067 run first." } as const;

  const nameById = new Map((famRows ?? []).map((f) => [f.id, f.name]));
  const existingKeys = new Set<string>();
  for (const r of roleRows ?? []) {
    const fname = nameById.get(r.job_family_id);
    if (fname) existingKeys.add(keyOf(fname, r.title));
  }
  const existingFamilies = new Set((famRows ?? []).map((f) => f.name.trim().toLowerCase().replace(/\s+/g, " ")));
  const validation = validateRoleRows(rows, existingKeys, existingFamilies);
  return { ok: true, supabase, userId: user.id, organizationId, famRows: famRows ?? [], validation } as const;
}

export async function previewRolesImport(rows: RolesImportRow[]): Promise<RolesImportPreview> {
  const v = await validateAgainstCompany(rows);
  if (!v.ok) return { error: v.error };
  const { results, ok, duplicates, errors, newFamilies } = v.validation;
  return { results, ok, duplicates, errors, newFamilies };
}

export async function commitRolesImport(rows: RolesImportRow[]): Promise<RolesImportResult> {
  const v = await validateAgainstCompany(rows);
  if (!v.ok) return { error: v.error };
  const { supabase, userId, organizationId, famRows, validation } = v;
  const toCreate = validation.roles.filter((r): r is NonNullable<typeof r> => r !== null);
  if (toCreate.length === 0) return { error: "Nothing to add: every row was skipped or has a mistake." };

  // 1. Families that do not exist yet.
  const familyId = new Map<string, string>(famRows.map((f) => [f.name.trim().toLowerCase().replace(/\s+/g, " "), f.id]));
  let familiesCreated = 0;
  if (validation.newFamilies.length > 0) {
    const { data, error } = await supabase
      .from("job_families")
      .insert(validation.newFamilies.map((name) => ({ organization_id: organizationId, name, description: "", created_by: userId })))
      .select("id, name")
      .returns<{ id: string; name: string }[]>();
    if (error || !data) {
      console.error("commitRolesImport families failed:", error);
      return { error: "Could not add the job families. Nothing was added; try again." };
    }
    for (const f of data) familyId.set(f.name.trim().toLowerCase().replace(/\s+/g, " "), f.id);
    familiesCreated = data.length;
  }

  // 2. The roles, in small batches.
  let rolesCreated = 0;
  for (let i = 0; i < toCreate.length; i += CHUNK) {
    const batch = toCreate.slice(i, i + CHUNK).map((r) => ({
      organization_id: organizationId,
      job_family_id: familyId.get(r.family.toLowerCase().replace(/\s+/g, " ")),
      title: r.title,
      level: r.level,
      grade: r.grade,
      track: r.track,
      responsibilities: r.responsibilities,
      created_by: userId,
    }));
    if (batch.some((b) => !b.job_family_id)) return { error: "A job family could not be found. Nothing more was added; try again." };
    const { error } = await supabase.from("job_roles").insert(batch);
    if (error) {
      console.error("commitRolesImport roles failed:", error);
      return { error: `Added ${rolesCreated} of ${toCreate.length} roles, then something went wrong. Upload the same file again to add the rest: roles already added are skipped.` };
    }
    rolesCreated += batch.length;
  }

  revalidatePath("/dashboard/company/job-architecture");
  return { success: true, rolesCreated, familiesCreated, skipped: validation.duplicates + validation.errors };
}
