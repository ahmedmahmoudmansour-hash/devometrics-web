"use server";

// Recording the conditions an assessment is taken under (migration 0210). Every call is best effort: if the table is not there yet,
// or anything fails, the assessment simply runs without recording and nothing breaks. The database enforces the real rules
// (start time on its own clock, counters only up, one promise, finish once, "late" worked out by the database).

import { createClient } from "@/lib/supabase/server";
import { isIntegrityKind, mapRow, type IntegrityDbRow, type IntegrityKind, type IntegrityRow, type IntegrityState, type TypingSummary } from "@/lib/integrity/core";

const COLUMNS = "attested_at, started_at, time_limit_seconds, left_page_count, away_seconds, typing, finished_at, late";
type Supabase = Awaited<ReturnType<typeof createClient>>;

const unavailable = (): IntegrityState => ({ available: false, row: null, serverNow: Date.now() });
const missingTable = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205" || e?.code === "PGRST200";
const validKey = (k: unknown): k is string => typeof k === "string" && k.length >= 1 && k.length <= 120;

async function who(): Promise<{ supabase: Supabase; userId: string; organizationId: string | null } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: m } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).limit(1).maybeSingle<{ organization_id: string }>();
  return { supabase, userId: user.id, organizationId: m?.organization_id ?? null };
}

async function read(supabase: Supabase, userId: string, kind: IntegrityKind, key: string): Promise<{ row: IntegrityRow | null; ok: boolean }> {
  const { data, error } = await supabase.from("assessment_integrity").select(COLUMNS).eq("employee_user_id", userId).eq("kind", kind).eq("subject_key", key).maybeSingle<IntegrityDbRow>();
  if (error) return { row: null, ok: false };
  return { row: data ? mapRow(data) : null, ok: true };
}

// The sitting so far, for the person taking it (their own row).
export async function getIntegrity(kind: IntegrityKind, subjectKey: string): Promise<IntegrityState> {
  try {
    if (!isIntegrityKind(kind) || !validKey(subjectKey)) return unavailable();
    const c = await who();
    if (!c) return unavailable();
    const { data, error } = await c.supabase.from("assessment_integrity").select(COLUMNS).eq("employee_user_id", c.userId).eq("kind", kind).eq("subject_key", subjectKey).maybeSingle<IntegrityDbRow>();
    if (error) return unavailable();
    return { available: true, row: data ? mapRow(data) : null, serverNow: Date.now() };
  } catch (err) {
    console.error("getIntegrity failed:", err);
    return unavailable();
  }
}

// The person made the promise and starts. Idempotent: starting again returns the same sitting (the clock never restarts).
export async function beginIntegrity(kind: IntegrityKind, subjectKey: string, timeLimitSeconds: number | null): Promise<IntegrityState> {
  try {
    if (!isIntegrityKind(kind) || !validKey(subjectKey)) return unavailable();
    const c = await who();
    if (!c) return unavailable();
    const existing = await c.supabase.from("assessment_integrity").select(COLUMNS).eq("employee_user_id", c.userId).eq("kind", kind).eq("subject_key", subjectKey).maybeSingle<IntegrityDbRow>();
    if (existing.error) return unavailable();
    if (existing.data) return { available: true, row: mapRow(existing.data), serverNow: Date.now() };
    const limit = typeof timeLimitSeconds === "number" && Number.isFinite(timeLimitSeconds) ? Math.min(36000, Math.max(30, Math.round(timeLimitSeconds))) : null;
    const { data, error } = await c.supabase
      .from("assessment_integrity")
      .insert({ organization_id: c.organizationId, employee_user_id: c.userId, kind, subject_key: subjectKey, attested_at: new Date().toISOString(), time_limit_seconds: limit })
      .select(COLUMNS)
      .single<IntegrityDbRow>();
    if (error || !data) {
      if (!missingTable(error)) console.error("beginIntegrity failed:", error);
      return unavailable();
    }
    return { available: true, row: mapRow(data), serverNow: Date.now() };
  } catch (err) {
    console.error("beginIntegrity failed:", err);
    return unavailable();
  }
}

// The person came back to the page after leaving it; awaySeconds is how long they were away.
export async function noteIntegrityLeave(kind: IntegrityKind, subjectKey: string, awaySeconds: number): Promise<boolean> {
  try {
    if (!isIntegrityKind(kind) || !validKey(subjectKey)) return false;
    const c = await who();
    if (!c) return false;
    const { row } = await read(c.supabase, c.userId, kind, subjectKey);
    if (!row || row.finishedAt) return false;
    const away = Math.min(7200, Math.max(0, Math.round(Number.isFinite(awaySeconds) ? awaySeconds : 0)));
    const { error } = await c.supabase
      .from("assessment_integrity")
      .update({ left_page_count: Math.min(999, row.leftPage + 1), away_seconds: Math.min(86400, row.awaySeconds + away) })
      .eq("employee_user_id", c.userId)
      .eq("kind", kind)
      .eq("subject_key", subjectKey)
      .is("finished_at", null);
    return !error;
  } catch (err) {
    console.error("noteIntegrityLeave failed:", err);
    return false;
  }
}

// The sitting is over (submitted). The database sets the finish time and works out "late"; the typing summary is recorded with it.
export async function finishIntegrity(kind: IntegrityKind, subjectKey: string, typing?: TypingSummary | null): Promise<boolean> {
  try {
    if (!isIntegrityKind(kind) || !validKey(subjectKey)) return false;
    const c = await who();
    if (!c) return false;
    const patch: Record<string, unknown> = { finished_at: new Date().toISOString() };
    if (typing) patch.typing = { answers: typing.answers, chars: typing.chars, bulkInserts: typing.bulkInserts };
    const { error } = await c.supabase.from("assessment_integrity").update(patch).eq("employee_user_id", c.userId).eq("kind", kind).eq("subject_key", subjectKey).is("finished_at", null);
    return !error;
  } catch (err) {
    console.error("finishIntegrity failed:", err);
    return false;
  }
}

// For a manager or admin (or the person) looking at a result: row level security decides whether anything comes back.
export async function getIntegrityFor(kind: IntegrityKind, subjectKey: string, employeeUserId: string): Promise<IntegrityRow | null> {
  try {
    if (!isIntegrityKind(kind) || !validKey(subjectKey) || typeof employeeUserId !== "string") return null;
    const supabase = await createClient();
    const { data, error } = await supabase.from("assessment_integrity").select(COLUMNS).eq("employee_user_id", employeeUserId).eq("kind", kind).eq("subject_key", subjectKey).maybeSingle<IntegrityDbRow>();
    if (error || !data) return null;
    return mapRow(data);
  } catch {
    return null;
  }
}

export type IntegrityListItem = { id: string; kind: IntegrityKind; subjectKey: string; row: IntegrityRow };

// A person's recent sittings of the tests that have no page of their own (cognitive, English, case studies).
export async function listIntegrityForEmployee(employeeUserId: string): Promise<IntegrityListItem[]> {
  try {
    if (typeof employeeUserId !== "string") return [];
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("assessment_integrity")
      .select(`id, kind, subject_key, ${COLUMNS}`)
      .eq("employee_user_id", employeeUserId)
      .in("kind", ["cognitive", "english", "case_study"])
      .order("started_at", { ascending: false })
      .limit(30)
      .returns<(IntegrityDbRow & { id: string; kind: IntegrityKind; subject_key: string })[]>();
    if (error || !data) return [];
    return data.map((d) => ({ id: d.id, kind: d.kind, subjectKey: d.subject_key, row: mapRow(d) }));
  } catch {
    return [];
  }
}
