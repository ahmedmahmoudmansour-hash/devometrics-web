"use server";

// Putting many people into their jobs at once from a file (employee email + job title). The browser only reads the file; the caller is
// re-checked here as a company admin, every row is re-validated with the same rules the preview used, and each change is written as the
// signed-in admin, so every database rule applies exactly as for setting one person's job by hand. A person already in the job is left
// alone, so the same file can be uploaded again safely.

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/jobArchitecture/actions";
import { MAX_ROWS, validatePlacements, type PlaceRow, type PlaceValidation } from "./placeCore";

export type PlacePreview = { error: string } | Pick<PlaceValidation, "results" | "ok" | "unchanged" | "errors">;
export type PlaceResult = { error: string } | { success: true; placed: number; skipped: number; failed: number };

function clean(rows: unknown): PlaceRow[] | null {
  if (!Array.isArray(rows)) return null;
  const s = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "");
  return rows.slice(0, MAX_ROWS + 1).map((r) => {
    const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    return { email: s(o.email), title: s(o.title), family: s(o.family) };
  });
}

async function load(rawRows: unknown) {
  const rows = clean(rawRows);
  if (!rows || rows.length === 0) return { ok: false, error: "The file has no data rows." } as const;
  if (rows.length > MAX_ROWS) return { ok: false, error: `Too many rows (more than ${MAX_ROWS}). Upload at most ${MAX_ROWS} at a time.` } as const;
  const { supabase, user, organizationId } = await requireAdmin();
  if (!user || !organizationId) return { ok: false, error: "Not authorized" } as const;

  const [{ data: memberRows, error: memErr }, { data: roleRows, error: roleErr }, { data: famRows, error: famErr }] = await Promise.all([
    supabase.from("organization_members").select("id, user_id, current_role_id").eq("organization_id", organizationId).returns<{ id: string; user_id: string; current_role_id: string | null }[]>(),
    supabase.from("job_roles").select("id, title, job_family_id").eq("organization_id", organizationId).returns<{ id: string; title: string; job_family_id: string }[]>(),
    supabase.from("job_families").select("id, name").eq("organization_id", organizationId).returns<{ id: string; name: string }[]>(),
  ]);
  if (memErr || roleErr || famErr) return { ok: false, error: "Could not read your people or your Job Architecture. The database may need migration 0067 run first." } as const;

  const ids = (memberRows ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, email").in("id", ids).returns<{ id: string; email: string | null }[]>() : { data: [] as { id: string; email: string | null }[] };
  const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email ?? ""]));
  const famName = new Map((famRows ?? []).map((f) => [f.id, f.name]));

  const validation = validatePlacements(
    rows,
    (memberRows ?? []).filter((m) => emailById.get(m.user_id)).map((m) => ({ memberId: m.id, email: emailById.get(m.user_id) as string, currentRoleId: m.current_role_id })),
    (roleRows ?? []).map((r) => ({ id: r.id, title: r.title, family: famName.get(r.job_family_id) ?? "" }))
  );
  return { ok: true, supabase, organizationId, validation } as const;
}

export async function previewPlacements(rows: PlaceRow[]): Promise<PlacePreview> {
  const v = await load(rows);
  if (!v.ok) return { error: v.error };
  const { results, ok, unchanged, errors } = v.validation;
  return { results, ok, unchanged, errors };
}

export async function commitPlacements(rows: PlaceRow[]): Promise<PlaceResult> {
  const v = await load(rows);
  if (!v.ok) return { error: v.error };
  const { supabase, organizationId, validation } = v;
  const todo = validation.changes.filter((c): c is NonNullable<typeof c> => c !== null);
  if (todo.length === 0) return { error: "Nothing to change: every row is already in place or has a mistake." };

  let placed = 0;
  let failed = 0;
  for (let i = 0; i < todo.length; i += 20) {
    const batch = todo.slice(i, i + 20);
    const done = await Promise.all(
      batch.map(async (c) => {
        const { error, data } = await supabase.from("organization_members").update({ current_role_id: c.roleId }).eq("id", c.memberId).eq("organization_id", organizationId).select("id");
        if (error) console.error("commitPlacements update failed:", error);
        return !error && !!data && data.length > 0;
      })
    );
    for (const ok of done) ok ? placed++ : failed++;
  }
  revalidatePath("/dashboard/company/job-architecture");
  revalidatePath("/dashboard/company/employees");
  revalidatePath("/dashboard/company/readiness");
  return { success: true, placed, skipped: validation.unchanged + validation.errors, failed };
}
