import { createClient } from "@/lib/supabase/server";
import type { CompetencyDimension } from "@/lib/gap-analysis/dimensions";
import type { GapAnalysis } from "@/lib/supabase/types";

export type TeamPulseMember = {
  userId: string;
  name: string;
  email: string;
  careerHealthScore: number | null;
  topGap: { dimension: CompetencyDimension; gapSize: number } | null;
  targetRole: string | null;
};

// Deliberately excludes Flight Risk — that score is admin-only by design
// (migration 0099), the same posture as AI spend figures: a line manager
// seeing a raw risk score on their own report risks the manager acting on
// it directly rather than it going through HR first. Career health + top
// gap are the same measured data an employee already sees about
// themselves, just rolled up for whoever manages them — nothing new is
// exposed that the employee didn't already know was visible to their org.
export async function listMyTeamPulse(): Promise<{ members: TeamPulseMember[]; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { members: [] };

  const { data: reports, error: reportsError } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("manager_user_id", user.id)
    .returns<{ user_id: string }[]>();
  if (reportsError) return { members: [], error: "not_migrated" };
  if (!reports || reports.length === 0) return { members: [] };

  const reportIds = reports.map((r) => r.user_id);
  type ReportAnalysis = Pick<GapAnalysis, "user_id" | "career_health_score" | "competencies" | "target_role" | "created_at">;

  const [{ data: profiles }, { data: analyses }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").in("id", reportIds).returns<{ id: string; full_name: string | null; email: string }[]>(),
    // RLS (migration 0100) permits a manager to read exactly these rows —
    // their own direct reports' Gap Analyses, nothing else.
    supabase
      .from("gap_analyses")
      .select("user_id, career_health_score, competencies, target_role, created_at")
      .in("user_id", reportIds)
      .order("created_at", { ascending: false })
      .returns<ReportAnalysis[]>(),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  // Most recent analysis per person — same "latest snapshot" convention
  // used everywhere else this data is rolled up (e.g. buildCompanyData).
  const latestByUser = new Map<string, ReportAnalysis>();
  for (const a of analyses ?? []) {
    if (!latestByUser.has(a.user_id)) latestByUser.set(a.user_id, a);
  }

  const members: TeamPulseMember[] = reportIds.map((userId) => {
    const profile = profileById.get(userId);
    const analysis = latestByUser.get(userId);
    const topGap = analysis
      ? [...analysis.competencies].sort((a, b) => b.gapSize - a.gapSize)[0]
      : undefined;
    return {
      userId,
      name: profile?.full_name || profile?.email || userId,
      email: profile?.email ?? "",
      careerHealthScore: analysis?.career_health_score ?? null,
      topGap: topGap ? { dimension: topGap.dimension, gapSize: topGap.gapSize } : null,
      targetRole: analysis?.target_role ?? null,
    };
  });

  return { members };
}
