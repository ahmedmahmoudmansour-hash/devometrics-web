import { createClient } from "@/lib/supabase/server";

export type MonthlyPoint = { label: string; value: number | null };

const TREND_MONTHS = 6;

// Last N calendar months including the current one, oldest first — e.g.
// run in August: [Mar, Apr, May, Jun, Jul, Aug]. Shared by every trend
// below so they all bucket identically and stay visually aligned when
// shown side by side.
function lastMonths(n: number): { year: number; month: number; label: string }[] {
  const now = new Date();
  const months: { year: number; month: number; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: d.toLocaleDateString(undefined, { month: "short" }),
    });
  }
  return months;
}

function bucketKey(year: number, month: number): string {
  return `${year}-${month}`;
}

// Average of every Gap Analysis run that month, across every current
// member of the org — not one score per person, not a re-scoring. A month
// with zero analyses run anywhere in the org yields null (rendered as a
// gap in the line, never a fabricated flat value) rather than a
// misleading 0 or a carried-forward previous value.
export async function careerHealthTrend(memberUserIds: string[]): Promise<MonthlyPoint[]> {
  const months = lastMonths(TREND_MONTHS);
  if (memberUserIds.length === 0) return months.map((m) => ({ label: m.label, value: null }));

  const supabase = await createClient();
  const windowStart = new Date(months[0].year, months[0].month, 1).toISOString();
  const { data } = await supabase
    .from("gap_analyses")
    .select("career_health_score, created_at")
    .in("user_id", memberUserIds)
    .gte("created_at", windowStart)
    .returns<{ career_health_score: number; created_at: string }[]>();

  const byBucket = new Map<string, number[]>();
  for (const row of data ?? []) {
    const d = new Date(row.created_at);
    const key = bucketKey(d.getFullYear(), d.getMonth());
    const list = byBucket.get(key) ?? [];
    list.push(row.career_health_score);
    byBucket.set(key, list);
  }

  return months.map((m) => {
    const scores = byBucket.get(bucketKey(m.year, m.month));
    return {
      label: m.label,
      value: scores && scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    };
  });
}

// Cumulative headcount at the end of each month — how many of the
// organization's CURRENT members had already joined by then. This
// necessarily undercounts anyone who joined and later left within the
// window (their join row is gone), so it reads as "growth of today's
// team" rather than a true historical headcount audit — an honest
// distinction to keep in mind if this is ever surfaced as compliance data.
export async function headcountTrend(organizationId: string): Promise<MonthlyPoint[]> {
  const months = lastMonths(TREND_MONTHS);
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_members")
    .select("created_at")
    .eq("organization_id", organizationId)
    .returns<{ created_at: string }[]>();

  const joinDates = (data ?? []).map((r) => new Date(r.created_at)).sort((a, b) => a.getTime() - b.getTime());

  return months.map((m) => {
    const endOfMonth = new Date(m.year, m.month + 1, 1);
    const count = joinDates.filter((d) => d < endOfMonth).length;
    return { label: m.label, value: count };
  });
}

// Average Flight Risk score per month, only from scores an admin actually
// ran (see lib/retention/ai.ts — this never triggers new scoring). Returns
// null entirely (not a series of nulls) if the feature has never been used
// at all, so the dashboard can omit the whole section rather than show an
// empty chart for a feature nobody has touched yet.
export async function flightRiskTrend(organizationId: string): Promise<MonthlyPoint[] | null> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("employee_flight_risk_scores")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  if (!count) return null;

  const months = lastMonths(TREND_MONTHS);
  const windowStart = new Date(months[0].year, months[0].month, 1).toISOString();
  const { data } = await supabase
    .from("employee_flight_risk_scores")
    .select("score, created_at")
    .eq("organization_id", organizationId)
    .gte("created_at", windowStart)
    .returns<{ score: number; created_at: string }[]>();

  const byBucket = new Map<string, number[]>();
  for (const row of data ?? []) {
    const d = new Date(row.created_at);
    const key = bucketKey(d.getFullYear(), d.getMonth());
    const list = byBucket.get(key) ?? [];
    list.push(row.score);
    byBucket.set(key, list);
  }

  return months.map((m) => {
    const scores = byBucket.get(bucketKey(m.year, m.month));
    return {
      label: m.label,
      value: scores && scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    };
  });
}
