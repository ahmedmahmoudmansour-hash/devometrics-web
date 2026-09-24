"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Bulk import of leave already taken (an Excel/CSV a company keeps today).
// The browser only parses the file; everything trusted happens here: the
// caller is re-checked as an org admin, emails/leave types are resolved
// against the real org, and rows are written the same way
// recordLeaveDirectly does (pre-approved, so the balance trigger updates
// used days). Days is required rather than derived from the dates — which
// days count as a weekend differs by country, and guessing wrong would
// silently corrupt balances.

export type LeaveImportRow = {
  employeeEmail: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  days: string;
  reason: string;
};

export type LeaveImportRowResult = { status: "ok" | "duplicate" | "error"; message?: string };

export type LeaveImportPreview =
  | { error: string }
  | { results: LeaveImportRowResult[]; ok: number; duplicates: number; errors: number };

const MAX_ROWS = 500;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function calendarDays(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
}

type Validated = {
  results: LeaveImportRowResult[];
  toInsert: { employee_user_id: string; leave_type_id: string; start_date: string; end_date: string; days_requested: number; reason: string | null }[];
  userId: string;
};

async function validateRows(organizationId: string, rows: LeaveImportRow[]): Promise<{ error: string } | Validated> {
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
  if (me?.role !== "admin") return { error: "Only a company admin can import leave." };

  const [{ data: members }, { data: types }] = await Promise.all([
    supabase.from("organization_members").select("user_id").eq("organization_id", organizationId).returns<{ user_id: string }[]>(),
    supabase.from("leave_types").select("id, name").eq("organization_id", organizationId).returns<{ id: string; name: string }[]>(),
  ]);
  const memberIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = memberIds.length
    ? await supabase.from("profiles").select("id, email").in("id", memberIds).returns<{ id: string; email: string | null }[]>()
    : { data: [] as { id: string; email: string | null }[] };

  const userByEmail = new Map<string, string>();
  for (const p of profiles ?? []) if (p.email) userByEmail.set(p.email.trim().toLowerCase(), p.id);
  const typeByName = new Map<string, string>();
  for (const t of types ?? []) typeByName.set(t.name.trim().toLowerCase(), t.id);

  // Only requests overlapping the file's own date span can be duplicates —
  // narrowing keeps this well under PostgREST's default 1000-row cap.
  const validStarts = rows.map((r) => (r.startDate ?? "").trim()).filter(isRealIsoDate).sort();
  const validEnds = rows.map((r) => (r.endDate ?? "").trim()).filter(isRealIsoDate).sort();
  let existingQuery = supabase
    .from("leave_requests")
    .select("employee_user_id, leave_type_id, start_date, end_date")
    .eq("organization_id", organizationId)
    .in("status", ["pending", "approved"]);
  if (validStarts.length && validEnds.length) {
    existingQuery = existingQuery.gte("start_date", validStarts[0]).lte("end_date", validEnds[validEnds.length - 1]);
  }
  const { data: existing } = await existingQuery
    .returns<{ employee_user_id: string; leave_type_id: string; start_date: string; end_date: string }[]>();
  const seen = new Set((existing ?? []).map((r) => `${r.employee_user_id}|${r.leave_type_id}|${r.start_date}|${r.end_date}`));
  const existingKeys = new Set(seen);

  const results: LeaveImportRowResult[] = [];
  const toInsert: Validated["toInsert"] = [];

  for (const row of rows) {
    const email = (row.employeeEmail ?? "").trim().toLowerCase();
    const typeName = (row.leaveTypeName ?? "").trim();
    const start = (row.startDate ?? "").trim();
    const end = (row.endDate ?? "").trim();
    const daysText = (row.days ?? "").toString().trim();
    const reason = (row.reason ?? "").trim();

    const fail = (message: string) => results.push({ status: "error", message });

    if (!email) { fail("Employee email is missing."); continue; }
    const userId = userByEmail.get(email);
    if (!userId) { fail("No employee with this email in your company."); continue; }
    if (!typeName) { fail("Leave type is missing."); continue; }
    const typeId = typeByName.get(typeName.toLowerCase());
    if (!typeId) { fail(`Unknown leave type "${typeName}" — add it under Settings first.`); continue; }
    if (!isRealIsoDate(start) || !isRealIsoDate(end)) { fail("Start and end must be real Excel dates (or YYYY-MM-DD)."); continue; }
    if (end < start) { fail("End date is before the start date."); continue; }
    const days = Number(daysText);
    if (!daysText || !Number.isFinite(days) || days <= 0) { fail("Days is required and must be a positive number."); continue; }
    if (Math.round(days * 10) / 10 !== days) { fail("Days can have at most one decimal place (e.g. 0.5)."); continue; }
    if (days > calendarDays(start, end)) { fail("Days is more than the number of calendar days in the range."); continue; }
    if (reason.length > 500) { fail("Reason is longer than 500 characters."); continue; }

    const key = `${userId}|${typeId}|${start}|${end}`;
    if (seen.has(key)) {
      results.push({ status: "duplicate", message: existingKeys.has(key) ? "Already recorded." : "Repeated earlier in this file." });
      continue;
    }
    seen.add(key);
    results.push({ status: "ok" });
    toInsert.push({ employee_user_id: userId, leave_type_id: typeId, start_date: start, end_date: end, days_requested: days, reason: reason || null });
  }

  return { results, toInsert, userId: user.id };
}

export async function previewLeaveImport(organizationId: string, rows: LeaveImportRow[]): Promise<LeaveImportPreview> {
  const v = await validateRows(organizationId, rows);
  if ("error" in v) return v;
  return {
    results: v.results,
    ok: v.results.filter((r) => r.status === "ok").length,
    duplicates: v.results.filter((r) => r.status === "duplicate").length,
    errors: v.results.filter((r) => r.status === "error").length,
  };
}

// Re-validates from scratch (never trusts a preview the client holds) and
// writes every valid row in ONE insert, so a database failure leaves nothing
// half-imported. Rows with errors/duplicates are simply skipped.
export async function commitLeaveImport(
  organizationId: string,
  rows: LeaveImportRow[]
): Promise<{ error: string } | { imported: number; skipped: number }> {
  const v = await validateRows(organizationId, rows);
  if ("error" in v) return v;
  if (v.toInsert.length === 0) return { error: "Nothing to import — every row has an error or is already recorded." };

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("leave_requests").insert(
    v.toInsert.map((r) => ({
      organization_id: organizationId,
      ...r,
      status: "approved",
      decided_at: now,
      decided_by: v.userId,
    }))
  );
  if (error) {
    console.error("commitLeaveImport failed:", error);
    return { error: "Could not save the import — nothing was imported. Try again, or import fewer rows." };
  }

  revalidatePath("/dashboard/company/leave");
  return { imported: v.toInsert.length, skipped: rows.length - v.toInsert.length };
}
