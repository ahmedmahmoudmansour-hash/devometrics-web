import type { createClient } from "@/lib/supabase/server";
import type { CompanyData } from "@/lib/organizations/aggregate";
import { computeNineBoxPoint, zoneForPoint } from "@/lib/organizations/nineBox";
import type { FlightRiskSignals } from "./types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Reuses the workforce row buildCompanyData() already computed (dimension
// levels, performance rating, milestone counts) instead of re-deriving
// them — this only queries the handful of things that row doesn't carry:
// succession nominations, manager notes, survey participation, and
// exit-interview attrition context.
export async function gatherFlightRiskSignals(
  supabase: SupabaseServerClient,
  company: CompanyData,
  employeeUserId: string
): Promise<{ signals: FlightRiskSignals; managerNotes: string[] } | null> {
  const row = company.rows.find((r) => r.userId === employeeUserId);
  if (!row || !company.organizationId) return null;

  const point = computeNineBoxPoint(row.dimensionLevels);
  const highPotential = point !== null && zoneForPoint(point.x, point.y).label === "High Potential";

  const [
    { data: nomination },
    { data: managerNoteRows },
    { data: assignmentRows },
    { data: responseRows },
    { data: exitInterviewRows },
    { data: memberRow },
  ] = await Promise.all([
    supabase.from("succession_nominations").select("id").eq("employee_user_id", employeeUserId).limit(1).maybeSingle<{ id: string }>(),
    supabase.from("employee_manager_notes").select("note").eq("employee_user_id", employeeUserId).eq("organization_id", company.organizationId).returns<{ note: string }[]>(),
    supabase.from("survey_assignments").select("survey_id").eq("employee_user_id", employeeUserId).returns<{ survey_id: string }[]>(),
    supabase.from("survey_responses").select("survey_id").eq("user_id", employeeUserId).returns<{ survey_id: string }[]>(),
    supabase.from("exit_interviews").select("department, manager_name").eq("organization_id", company.organizationId).returns<{ department: string | null; manager_name: string | null }[]>(),
    supabase.from("organization_members").select("created_at, manager_name").eq("organization_id", company.organizationId).eq("user_id", employeeUserId).maybeSingle<{ created_at: string; manager_name: string | null }>(),
  ]);

  const tenureDays = memberRow ? Math.floor((Date.now() - new Date(memberRow.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;

  const respondedSurveyIds = new Set((responseRows ?? []).map((r) => r.survey_id));
  const surveyParticipationRate =
    (assignmentRows ?? []).length > 0 ? (assignmentRows ?? []).filter((a) => respondedSurveyIds.has(a.survey_id)).length / (assignmentRows ?? []).length : null;

  // Free-text match, not a real FK (manager_name on both sides is
  // operator-entered) — a reasonable v1 heuristic for "does this person's
  // department/manager show up in past departures", not a precise join.
  const departmentExitCount = row.department
    ? (exitInterviewRows ?? []).filter((e) => e.department?.toLowerCase().trim() === row.department?.toLowerCase().trim()).length
    : 0;
  const managerExitCount = memberRow?.manager_name
    ? (exitInterviewRows ?? []).filter((e) => e.manager_name?.toLowerCase().trim() === memberRow.manager_name?.toLowerCase().trim()).length
    : 0;

  const signals: FlightRiskSignals = {
    tenureDays,
    department: row.department,
    highPotential,
    successionNominee: !!nomination,
    currentPerformanceRating: row.performanceRating,
    activePlanCount: row.plans,
    milestoneCompletionRate: row.milestonesTotal > 0 ? row.milestonesDone / row.milestonesTotal : null,
    surveyParticipationRate,
    managerNotesCount: (managerNoteRows ?? []).length,
    departmentExitCount,
    managerExitCount,
  };

  return { signals, managerNotes: (managerNoteRows ?? []).map((n) => n.note).filter(Boolean) };
}

// Confidence is derived from how many of these 6 core signal categories
// actually have data for this person — deliberately NOT another AI
// opinion, so it reflects real data completeness rather than the model's
// own (potentially overconfident) read of a thin record.
export function computeConfidence(signals: FlightRiskSignals): "high" | "medium" | "low" {
  const present = [
    signals.currentPerformanceRating !== null,
    signals.activePlanCount > 0,
    signals.milestoneCompletionRate !== null,
    signals.surveyParticipationRate !== null,
    signals.managerNotesCount > 0,
    signals.departmentExitCount + signals.managerExitCount > 0,
  ].filter(Boolean).length;

  if (present >= 5) return "high";
  if (present >= 3) return "medium";
  return "low";
}
