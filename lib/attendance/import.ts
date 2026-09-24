"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Bulk import of attendance days (an Excel/CSV a company keeps today, or an
// export from a fingerprint/HR system). Same shape as the leave import: the
// browser only parses the file; the server re-checks the caller is an org
// admin, resolves emails, validates every row, skips days that already have a
// record (so a re-import never overwrites a correction) and writes all valid
// rows in one insert.

export type AttendanceImportRow = {
  employeeEmail: string;
  date: string;
  status: string;
  checkIn: string;
  checkOut: string;
  notes: string;
};

export type AttendanceImportRowResult = { status: "ok" | "duplicate" | "error"; message?: string };

export type AttendanceImportPreview =
  | { error: string }
  | { results: AttendanceImportRowResult[]; ok: number; duplicates: number; errors: number };

const MAX_ROWS = 2000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const STATUSES = ["present", "late", "remote", "absent", "holiday"];

function isRealIsoDate(v: string): boolean {
  if (!ISO_DATE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function normalizeTime(v: string): string | null {
  const m = TIME.exec(v.trim());
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

type Validated = {
  results: AttendanceImportRowResult[];
  toInsert: { user_id: string; work_date: string; status: string; check_in: string | null; check_out: string | null; notes: string | null }[];
  adminId: string;
};

async function validateRows(organizationId: string, rows: AttendanceImportRow[]): Promise<{ error: string } | Validated> {
  if (!Array.isArray(rows) || rows.length === 0) return { error: "The file has no data rows." };
  if (rows.length > MAX_ROWS) return { error: `Too many rows (${rows.length}) — import at most ${MAX_ROWS} at a time.` };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { data: me } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle<{ role: string }>();
  if (me?.role !== "admin") return { error: "Only a company admin can import attendance." };

  const { data: members } = await supabase.from("organization_members").select("user_id").eq("organization_id", organizationId).returns<{ user_id: string }[]>();
  const memberIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = memberIds.length
    ? await supabase.from("profiles").select("id, email").in("id", memberIds).returns<{ id: string; email: string | null }[]>()
    : { data: [] as { id: string; email: string | null }[] };
  const userByEmail = new Map<string, string>();
  for (const p of profiles ?? []) if (p.email) userByEmail.set(p.email.trim().toLowerCase(), p.id);

  const dates = rows.map((r) => (r.date ?? "").trim()).filter(isRealIsoDate).sort();
  let existingQuery = supabase.from("attendance_records").select("user_id, work_date").eq("organization_id", organizationId);
  if (dates.length) existingQuery = existingQuery.gte("work_date", dates[0]).lte("work_date", dates[dates.length - 1]);
  const { data: existing } = await existingQuery.limit(20000).returns<{ user_id: string; work_date: string }[]>();
  const existingKeys = new Set((existing ?? []).map((r) => `${r.user_id}|${r.work_date}`));
  const seen = new Set(existingKeys);

  const results: AttendanceImportRowResult[] = [];
  const toInsert: Validated["toInsert"] = [];

  for (const row of rows) {
    const email = (row.employeeEmail ?? "").trim().toLowerCase();
    const date = (row.date ?? "").trim();
    const statusText = (row.status ?? "").trim().toLowerCase();
    const inText = (row.checkIn ?? "").trim();
    const outText = (row.checkOut ?? "").trim();
    const notes = (row.notes ?? "").trim();
    const fail = (message: string) => results.push({ status: "error", message });

    if (!email) { fail("Employee email is missing."); continue; }
    const userId = userByEmail.get(email);
    if (!userId) { fail("No employee with this email in your company."); continue; }
    if (!isRealIsoDate(date)) { fail("Date must be a real Excel date (or YYYY-MM-DD)."); continue; }
    const status = statusText || "present";
    if (!STATUSES.includes(status)) { fail(`Status must be one of: ${STATUSES.join(", ")}.`); continue; }
    const checkIn = inText ? normalizeTime(inText) : null;
    const checkOut = outText ? normalizeTime(outText) : null;
    if (inText && !checkIn) { fail("Check-in must be a time like 09:05."); continue; }
    if (outText && !checkOut) { fail("Check-out must be a time like 17:30."); continue; }
    if (checkIn && checkOut && checkOut < checkIn) { fail("Check-out is before check-in."); continue; }
    if (notes.length > 300) { fail("Notes are longer than 300 characters."); continue; }

    const key = `${userId}|${date}`;
    if (seen.has(key)) {
      results.push({ status: "duplicate", message: existingKeys.has(key) ? "Already recorded." : "Repeated earlier in this file." });
      continue;
    }
    seen.add(key);
    results.push({ status: "ok" });
    toInsert.push({ user_id: userId, work_date: date, status, check_in: checkIn, check_out: checkOut, notes: notes || null });
  }

  return { results, toInsert, adminId: user.id };
}

export async function previewAttendanceImport(organizationId: string, rows: AttendanceImportRow[]): Promise<AttendanceImportPreview> {
  const v = await validateRows(organizationId, rows);
  if ("error" in v) return v;
  return {
    results: v.results,
    ok: v.results.filter((r) => r.status === "ok").length,
    duplicates: v.results.filter((r) => r.status === "duplicate").length,
    errors: v.results.filter((r) => r.status === "error").length,
  };
}

export async function commitAttendanceImport(
  organizationId: string,
  rows: AttendanceImportRow[]
): Promise<{ error: string } | { imported: number; skipped: number }> {
  const v = await validateRows(organizationId, rows);
  if ("error" in v) return v;
  if (v.toInsert.length === 0) return { error: "Nothing to import — every row has an error or is already recorded." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_records")
    .insert(v.toInsert.map((r) => ({ organization_id: organizationId, ...r, source: "import", created_by: v.adminId })));
  if (error) {
    console.error("commitAttendanceImport failed:", error);
    return { error: "Could not save the import — nothing was imported. Try again, or import fewer rows." };
  }
  revalidatePath("/dashboard/company/attendance");
  return { imported: v.toInsert.length, skipped: rows.length - v.toInsert.length };
}
