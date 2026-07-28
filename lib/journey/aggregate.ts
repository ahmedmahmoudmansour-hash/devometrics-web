import { createClient } from "@/lib/supabase/server";
import {
  type AssessmentTranslator,
  resolveAssessmentDisplayName,
  scoreBandLabel,
  scoreToBand,
} from "@/lib/assessments/catalog";
import { getRoleplayScenario, localizeScenario } from "@/lib/roleplay/scenarios";
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

// t: scoped to "journeyEvents". tCatalog/tBands/tScenarios are passed through
// unchanged to the already-built display helpers (resolveAssessmentDisplayName,
// scoreBandLabel, localizeScenario) rather than this function defining its own
// translation logic for assessment names, score bands, or scenario titles.
export type JourneyTranslator = {
  (key: string, values?: Record<string, string | number>): string;
  raw: (key: string) => unknown;
};

// A single reverse-chronological feed of real, already-stored accomplishments
// — not a new data source. Deliberately excludes raw coach_messages: showing
// every chat turn would make this a noisy activity log instead of a
// meaningful "here's your progress" narrative. If coach usage ever needs to
// show up here, it should be as a rolled-up "N conversations this month"
// summary, not per-message.
export async function buildJourney(
  t: JourneyTranslator,
  tCatalog: AssessmentTranslator,
  tBands: AssessmentTranslator,
  tScenarios: (key: string) => string
): Promise<JourneyEvent[]> {
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
    events.push({ date: profile.created_at, type: "joined", title: t("joined") });
  }

  for (const d of discovery ?? []) {
    events.push({
      date: d.created_at,
      type: "discovery",
      title: t("discovery"),
      href: "/dashboard/discovery",
    });
  }

  for (const a of analyses ?? []) {
    events.push({
      date: a.created_at,
      type: "gap-analysis",
      title: t("gapAnalysisTitle", { role: a.target_role }),
      description: t("gapAnalysisDescription", { score: a.career_health_score }),
      href: "/dashboard/gap-analysis",
    });
  }

  for (const r of results ?? []) {
    const band = scoreToBand(r.score);
    events.push({
      date: r.completed_at,
      type: "assessment",
      title: t("assessmentTitle", { name: resolveAssessmentDisplayName(tCatalog, r.assessment_slug) }),
      description: t("assessmentDescription", { score: r.score, band: scoreBandLabel(tBands, band) }),
      href: "/dashboard/assessments",
    });
  }

  for (const r of resumes ?? []) {
    events.push({
      date: r.created_at,
      type: "resume",
      title: t("resumeTitle"),
      description: t("resumeDescription", { score: r.overall_score }),
      href: "/dashboard/resume",
    });
  }

  for (const s of sessions ?? []) {
    const rawScenario = getRoleplayScenario(s.scenario_slug);
    const scenario = rawScenario ? localizeScenario(rawScenario, tScenarios) : null;
    events.push({
      date: s.updated_at,
      type: "roleplay",
      title: t("roleplayTitle", { scenario: scenario?.title ?? s.scenario_slug }),
      description: t("roleplayDescription"),
      href: "/dashboard/roleplay",
    });
  }

  for (const m of milestones ?? []) {
    if (!m.completed_at) continue;
    events.push({
      date: m.completed_at,
      type: "milestone",
      title: t("milestoneTitle", { title: m.title }),
      description: planTitleById.get(m.plan_id),
      href: "/dashboard",
    });
  }

  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
