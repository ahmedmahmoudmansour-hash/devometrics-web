import type { createClient } from "@/lib/supabase/server";

// Shared read layer over the score_events table (migration 0147). Replaces
// the three independent "fetch every historical gap_analyses row and
// dedupe to latest-per-user in TypeScript" implementations that used to
// live separately in lib/organizations/aggregate.ts, lib/scorecard/
// aggregate.ts, and lib/organizations/teamPulse.ts.
//
// score_events doesn't exist until migration 0147 is run — every function
// here degrades to an empty result on a query error (same "isolated query,
// graceful degrade" convention already used throughout aggregate.ts for
// every newer table), never throws.

export type ScoreEventSource =
  | "gap_analysis"
  | "career_health_snapshot"
  | "performance_review_self"
  | "performance_review_manager"
  | "performance_review_competency_self"
  | "performance_review_competency_manager"
  | "knowledge_hub_exam"
  | "assessment_result"
  | "case_study_exercise"
  | "resume_analysis"
  | "flight_risk"
  | "succession_fit"
  | "scorm_completion";

export type ScoreEventScale = "0_100" | "1_5";

export type ScoreEvent = {
  id: string;
  organizationId: string | null;
  employeeUserId: string;
  source: ScoreEventSource;
  dimension: string;
  rawValue: number;
  scale: ScoreEventScale;
  recordedAt: string;
  sourceTable: string;
  sourceId: string;
  metadata: Record<string, unknown>;
};

type ScoreEventRow = {
  id: string;
  organization_id: string | null;
  employee_user_id: string;
  source: string;
  dimension: string;
  raw_value: number;
  scale: string;
  recorded_at: string;
  source_table: string;
  source_id: string;
  metadata: Record<string, unknown>;
};

function mapRow(row: ScoreEventRow): ScoreEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    employeeUserId: row.employee_user_id,
    source: row.source as ScoreEventSource,
    dimension: row.dimension,
    rawValue: row.raw_value,
    scale: row.scale as ScoreEventScale,
    recordedAt: row.recorded_at,
    sourceTable: row.source_table,
    sourceId: row.source_id,
    metadata: row.metadata ?? {},
  };
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// One row per employee — the winning (most recent) score_events row for a
// given source/dimension, across a batch of employees. Backed by the
// latest_score_events() RPC (migration 0147), which does the real work with
// a single indexed DISTINCT ON query server-side, since postgrest's query
// builder can't express DISTINCT ON on its own.
export async function getLatestScoreEventPerEmployee(
  supabase: SupabaseServerClient,
  args: { employeeUserIds: string[]; source: ScoreEventSource; dimension?: string }
): Promise<Map<string, ScoreEvent>> {
  if (args.employeeUserIds.length === 0) return new Map();

  const { data, error } = await supabase.rpc("latest_score_events", {
    p_employee_user_ids: args.employeeUserIds,
    p_source: args.source,
    p_dimension: args.dimension ?? "",
  });
  if (error || !data) return new Map();

  const map = new Map<string, ScoreEvent>();
  for (const row of data as ScoreEventRow[]) {
    map.set(row.employee_user_id, mapRow(row));
  }
  return map;
}

// One whole-score event per (employee, source), across a batch of
// employees — a cross-source snapshot per employee (WorkforceRow.
// latestScores). Backed by latest_score_events_by_source() (migration
// 0147), restricted server-side to dimension = '' so this stays cheap at
// org scale.
export async function getLatestScoreEventsBySource(
  supabase: SupabaseServerClient,
  employeeUserIds: string[]
): Promise<Map<string, ScoreEvent[]>> {
  if (employeeUserIds.length === 0) return new Map();

  const { data, error } = await supabase.rpc("latest_score_events_by_source", {
    p_employee_user_ids: employeeUserIds,
  });
  if (error || !data) return new Map();

  const map = new Map<string, ScoreEvent[]>();
  for (const row of data as ScoreEventRow[]) {
    const list = map.get(row.employee_user_id) ?? [];
    list.push(mapRow(row));
    map.set(row.employee_user_id, list);
  }
  return map;
}

// The full chronological history for one employee, across every source —
// what the Employee Intelligence Timeline (Phase 2) renders. A plain
// ordered select is enough here (no DISTINCT ON needed for a single
// employee's full history), so no RPC required.
export async function getScoreHistoryForEmployee(
  supabase: SupabaseServerClient,
  employeeUserId: string
): Promise<ScoreEvent[]> {
  const { data, error } = await supabase
    .from("score_events")
    .select("*")
    .eq("employee_user_id", employeeUserId)
    .order("recorded_at", { ascending: true })
    .returns<ScoreEventRow[]>();
  if (error || !data) return [];
  return data.map(mapRow);
}

// One real-world event (a Gap Analysis run, a review cycle's competency
// ratings, ...) can produce several score_events rows sharing one
// (sourceTable, sourceId) — e.g. a Gap Analysis's whole-score row plus its
// 8 per-dimension rows. The Employee Intelligence Timeline groups by moment,
// not by raw row (per the approved plan's explicit UX constraint), so this
// collapses each such group into one entry before rendering.
export type ScoreMoment = {
  key: string;
  source: ScoreEventSource;
  sourceTable: string;
  sourceId: string;
  recordedAt: string;
  // The whole-score event (dimension === "") if this source has one,
  // otherwise the first dimension-level event stands in as the headline.
  headline: ScoreEvent;
  details: ScoreEvent[];
};

export function groupScoreHistoryIntoMoments(history: ScoreEvent[]): ScoreMoment[] {
  const groups = new Map<string, ScoreEvent[]>();
  for (const event of history) {
    const key = `${event.sourceTable}::${event.sourceId}`;
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }

  const moments: ScoreMoment[] = [];
  for (const [key, events] of groups) {
    const wholeScoreEvent = events.find((e) => e.dimension === "");
    const headline = wholeScoreEvent ?? events[0];
    moments.push({ key, source: headline.source, sourceTable: headline.sourceTable, sourceId: headline.sourceId, recordedAt: headline.recordedAt, headline, details: events });
  }
  return moments.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}
