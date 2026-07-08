import { createClient } from "@/lib/supabase/server";
import { getAssessment, scoreToBand } from "@/lib/assessments/catalog";
import { getRoleplayScenario } from "@/lib/roleplay/scenarios";
import type {
  AssessmentResult,
  DevelopmentPlan,
  DiscoveryProfile,
  GapAnalysis,
  Milestone,
  Profile,
  ResumeAnalysis,
  RoleplaySession,
} from "@/lib/supabase/types";

export type JourneyEvent = {
  date: string;
  type: "joined" | "discovery" | "gap-analysis" | "assessment" | "resume" | "roleplay" | "milestone";
  title: string;
  description?: string;
  href?: string;
};

// A single reverse-chronological feed of real, already-stored accomplishments
// — not a new data source. Deliberately excludes raw coach_messages: showing
// every chat turn would make this a noisy activity log instead of a
// meaningful "here's your progress" narrative. If coach usage ever needs to
// show up here, it should be as a rolled-up "N conversations this month"
// summary, not per-message.
export async function buildJourney(): Promise<JourneyEvent[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [{ data: profile }, { data: discovery }, { data: analyses }, { data: results }, { data: resumes }, { data: plans }, { data: sessions }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single<Profile>(),
      supabase.from("discovery_profiles").select("*").eq("user_id", user.id).returns<DiscoveryProfile[]>(),
      supabase.from("gap_analyses").select("*").eq("user_id", user.id).returns<GapAnalysis[]>(),
      supabase.from("assessment_results").select("*").eq("user_id", user.id).returns<AssessmentResult[]>(),
      supabase.from("resume_analyses").select("*").eq("user_id", user.id).returns<ResumeAnalysis[]>(),
      supabase.from("development_plans").select("*").eq("user_id", user.id).returns<DevelopmentPlan[]>(),
      supabase.from("roleplay_sessions").select("*").eq("user_id", user.id).eq("completed", true).returns<RoleplaySession[]>(),
    ]);

  const planIds = (plans ?? []).map((p) => p.id);
  const { data: milestones } = planIds.length
    ? await supabase
        .from("milestones")
        .select("*")
        .in("plan_id", planIds)
        .eq("completed", true)
        .returns<Milestone[]>()
    : { data: [] as Milestone[] };

  const planTitleById = new Map((plans ?? []).map((p) => [p.id, p.title]));

  const events: JourneyEvent[] = [];

  if (profile) {
    events.push({ date: profile.created_at, type: "joined", title: "Joined Devometrics" });
  }

  for (const d of discovery ?? []) {
    events.push({
      date: d.created_at,
      type: "discovery",
      title: "Completed the AI Discovery Interview",
      href: "/dashboard/discovery",
    });
  }

  for (const a of analyses ?? []) {
    events.push({
      date: a.created_at,
      type: "gap-analysis",
      title: `Ran a Gap Analysis for ${a.target_role}`,
      description: `Career Health Score: ${a.career_health_score}/100`,
      href: "/dashboard/gap-analysis",
    });
  }

  for (const r of results ?? []) {
    const assessment = getAssessment(r.assessment_slug);
    const band = scoreToBand(r.score);
    events.push({
      date: r.completed_at,
      type: "assessment",
      title: `Completed ${assessment?.name ?? r.assessment_slug}`,
      description: `${r.score}/100 — ${band.label}`,
      href: "/dashboard/assessments",
    });
  }

  for (const r of resumes ?? []) {
    events.push({
      date: r.created_at,
      type: "resume",
      title: "Ran Resume Intelligence",
      description: `Overall score: ${r.overall_score}/100`,
      href: "/dashboard/resume",
    });
  }

  for (const s of sessions ?? []) {
    const scenario = getRoleplayScenario(s.scenario_slug);
    events.push({
      date: s.updated_at,
      type: "roleplay",
      title: `Completed the "${scenario?.title ?? s.scenario_slug}" scenario`,
      description: "Feedback available in Scenarios",
      href: "/dashboard/roleplay",
    });
  }

  for (const m of milestones ?? []) {
    if (!m.completed_at) continue;
    events.push({
      date: m.completed_at,
      type: "milestone",
      title: `Completed a milestone: ${m.title}`,
      description: planTitleById.get(m.plan_id),
      href: "/dashboard",
    });
  }

  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
