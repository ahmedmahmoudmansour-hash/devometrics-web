import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import PlanSummaryCard from "@/components/dashboard/PlanSummaryCard";
import NewPlanForm from "@/components/dashboard/NewPlanForm";
import DataPrivacy from "@/components/dashboard/DataPrivacy";
import CareerHealthOverview from "@/components/dashboard/CareerHealthOverview";
import CompanyMembershipCard from "@/components/dashboard/CompanyMembershipCard";
import OnboardingChecklist from "@/components/dashboard/OnboardingChecklist";
import WelcomeModal from "@/components/dashboard/WelcomeModal";
import KeyTrendsCard from "@/components/dashboard/KeyTrendsCard";
import { checkAndConsumeInvite, getMyOrganizationMembership } from "@/lib/organizations/actions";
import { effectiveSubscriptionTier } from "@/lib/billing/subscriptionTier";
import PremiumTrialForm from "@/components/dashboard/PremiumTrialForm";
import UpgradeToPremiumCard from "@/components/dashboard/UpgradeToPremiumCard";
import AchievementsCard from "@/components/dashboard/AchievementsCard";
import CareerMomentumCard from "@/components/dashboard/CareerMomentumCard";
import PendingSurveysCard from "@/components/dashboard/PendingSurveysCard";
import PendingActionsPanel from "@/components/dashboard/PendingActionsPanel";
import { listMyPendingActions } from "@/lib/actionHub/actions";
import { recordDailyActivity } from "@/lib/engagement/streak";
import { syncAchievements } from "@/lib/achievements/evaluate";
import { computeCompositeScore } from "@/lib/dashboard/compositeScore";
import { recordAndComputeMomentum } from "@/lib/momentum/momentum";
import { listMySurveys } from "@/lib/surveys/actions";
import { listTodayTasks } from "@/lib/tasks/actions";
import DashboardSection from "@/components/dashboard/DashboardSection";
import DismissibleUpgradePrompt from "@/components/dashboard/DismissibleUpgradePrompt";
import StatRail from "@/components/dashboard/StatRail";
import CareerGpsCard from "@/components/dashboard/CareerGpsCard";
import WhatIfSimulator from "@/components/dashboard/WhatIfSimulator";
import DailyInsightBanner from "@/components/dashboard/DailyInsightBanner";
import { buildCareerGpsSnapshot } from "@/lib/careerGps/gps";
import { getDailyInsight } from "@/lib/careerGps/dailyInsight";
import { ONBOARDING_STEP_DEFS } from "@/lib/dashboard/onboardingSteps";
import type {
  AssessmentResult,
  DevelopmentPlan,
  DiscoveryProfile,
  GapAnalysis,
  Milestone,
  Profile,
  ResumeAnalysis,
} from "@/lib/supabase/types";

export default async function DashboardPage() {
  const t = await getTranslations("dashboardHome");
  const locale = await getLocale();
  const dateLocale = locale === "ar" ? "ar-u-nu-latn" : "en-US";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  let membership = await getMyOrganizationMembership();
  if (!membership) {
    // Auto-join if an admin pre-authorized this exact email — happens
    // regardless of which signup path they picked, so an invited employee
    // never has to think about invite codes at all.
    const joined = await checkAndConsumeInvite();
    if (joined) membership = await getMyOrganizationMembership();
  }
  if (profile?.account_type === "company" && !membership) {
    redirect("/dashboard/company/setup");
  }

  const { data: latestAnalysis } = await supabase
    .from("gap_analyses")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<GapAnalysis>();

  const { data: plans } = await supabase
    .from("development_plans")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .returns<DevelopmentPlan[]>();

  const planIds = (plans ?? []).map((p) => p.id);
  const { data: milestones } = planIds.length
    ? await supabase
        .from("milestones")
        .select("*")
        .in("plan_id", planIds)
        .returns<Milestone[]>()
    : { data: [] as Milestone[] };

  const { data: latestResume } = await supabase
    .from("resume_analyses")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ResumeAnalysis>();

  const { data: discoveryProfile } = await supabase
    .from("discovery_profiles")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<DiscoveryProfile>();

  const { data: assessmentResults } = await supabase
    .from("assessment_results")
    .select("assessment_slug, score")
    .eq("user_id", user.id)
    .returns<Pick<AssessmentResult, "assessment_slug" | "score">[]>();

  const latestScoreBySlug = new Map<string, number>();
  for (const r of assessmentResults ?? []) {
    if (!latestScoreBySlug.has(r.assessment_slug)) latestScoreBySlug.set(r.assessment_slug, r.score);
  }
  const assessmentScores = Array.from(latestScoreBySlug.values());
  const assessmentAverage = assessmentScores.length
    ? Math.round(assessmentScores.reduce((a, b) => a + b, 0) / assessmentScores.length)
    : null;

  // Isolated, defensive — only feeds the Career GPS card's Interview
  // Readiness component, so a query hiccup here just means that one signal
  // falls back to its no-practice-yet baseline rather than breaking the page.
  const { data: jobInterviewSession } = await supabase
    .from("roleplay_sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("scenario_slug", "job-interview")
    .eq("completed", true)
    .limit(1)
    .maybeSingle();
  const careerGps = latestAnalysis
    ? buildCareerGpsSnapshot(latestAnalysis, milestones ?? [], new Set(latestScoreBySlug.keys()), !!jobInterviewSession)
    : null;
  const dailyInsight = await getDailyInsight();

  const streakResult = await recordDailyActivity();
  const todayTasks = await listTodayTasks();
  const pendingActions = await listMyPendingActions();
  const { data: completedTaskCheck } = await supabase
    .from("personal_tasks")
    .select("id")
    .eq("user_id", user.id)
    .eq("completed", true)
    .limit(1)
    .maybeSingle();
  const earnedAchievements = await syncAchievements({
    hasAssessment: latestScoreBySlug.size > 0,
    hasGapAnalysis: !!latestAnalysis,
    hasPlan: (plans ?? []).length > 0,
    hasCompletedMilestone: (milestones ?? []).some((m) => m.completed),
    hasResume: !!latestResume,
    hasCompletedTask: !!completedTaskCheck,
    currentStreak: streakResult?.currentStreak ?? 0,
  });

  const compositeScore = computeCompositeScore([
    latestAnalysis?.career_health_score ?? null,
    assessmentAverage,
    latestResume?.overall_score ?? null,
  ]);
  const momentum = await recordAndComputeMomentum(compositeScore);
  const mySurveys = await listMySurveys();

  // Glanceable rail stats — all derived from data already fetched above,
  // no extra queries. "Next deadline" deliberately isn't limited to
  // UpcomingDeadlinesCard's 7-day window: that card only shows anything
  // when a deadline is imminent, but the rail should always have a real
  // answer if one exists further out.
  const pendingTasksToday = todayTasks.filter((t) => !t.completed).length;
  const nextDeadline = (milestones ?? [])
    .filter((m) => !m.completed && m.target_date)
    .sort((a, b) => (a.target_date as string).localeCompare(b.target_date as string))[0] ?? null;

  const onboardingDone = [
    !!discoveryProfile,
    latestScoreBySlug.size > 0,
    !!latestAnalysis,
    (plans ?? []).length > 0,
    !!latestResume,
  ];
  const onboardingSteps = ONBOARDING_STEP_DEFS.map((def, i) => ({
    label: t(def.labelKey),
    description: t(def.descriptionKey),
    href: def.href,
    done: onboardingDone[i],
  }));

  const careerHealthColor =
    compositeScore === null ? "var(--text-muted)" : compositeScore >= 70 ? "var(--teal)" : compositeScore >= 40 ? "var(--amber)" : "var(--danger)";

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <WelcomeModal
        name={profile?.full_name?.trim().split(/\s+/)[0] ?? null}
        role={membership?.role === "admin" ? "admin" : membership ? "member" : null}
      />
      <div className="dashboard-content-grid">
        <div className="dashboard-main" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{t("heading")}</h1>

          {dailyInsight && <DailyInsightBanner insight={dailyInsight} />}
          {careerGps && <CareerGpsCard snapshot={careerGps} />}

          {/* "Where do I start" comes before any exploratory tool — this
              used to sit below CareerGpsCard's "you are here" and the What
              If simulator, but CareerGpsCard only renders once a Gap
              Analysis exists, so a brand-new employee (the majority of
              first-time users, per 2026-08-13 feedback) landed on an
              advanced projection tool with zero orientation above it. */}
          <DashboardSection label={t("sectionToday")}>
            <OnboardingChecklist steps={onboardingSteps} />
            {/* One consolidated "needs your attention" list — tasks,
                Knowledge Hub, assigned assessments, an open performance
                review, and upcoming milestone deadlines — replacing what
                were 4 separate scattered cards, per the 2026-08-03
                strategic memo's "Unified Employee Action Hub" item.
                Surveys stay their own card: they answer inline right here
                (a real form, not a link-out), which the plain link-out
                rows below don't support and shouldn't regress to. */}
            <PendingActionsPanel actions={pendingActions} compact />
            <PendingSurveysCard surveys={mySurveys} />
          </DashboardSection>

          {/* Always open, not tucked inside "Career Health" — Trends and
              Recommended Learning are a research tool available to
              everyone from day one (no Gap Analysis required), not a
              personal progress metric. Leaving them inside the collapsed,
              metrics-only Career Health section (2026-08-13 feedback) meant
              a new employee had to know to expand a section full of empty
              placeholders just to find a tool that had nothing to do with
              "how am I doing." */}
          <DashboardSection label={t("sectionExplore")}>
            <KeyTrendsCard jobTitle={profile?.job_history?.[0]?.title ?? null} />
          </DashboardSection>

          {/* Collapsed by default (2026-08 UX audit's content-tiering fix):
              this section answers "how am I doing overall," which someone
              checks periodically, not "what do I do today" — the Today
              section above already covers the changes-every-visit content.
              Nothing here is hidden or removed, just not forced into the
              first scroll every single time. */}
          <DashboardSection label={t("sectionCareerHealth")} collapsible defaultOpen={false}>
            <CareerHealthOverview
              gapAnalysisScore={latestAnalysis?.career_health_score ?? null}
              assessmentAverage={assessmentAverage}
              resumeScore={latestResume?.overall_score ?? null}
            />
            <CareerMomentumCard momentum={momentum} />
            <AchievementsCard earnedKeys={earnedAchievements} badgesEnabled={profile?.badges_enabled ?? true} />
          </DashboardSection>

          {/* Moved below Today/Explore/Career Health (was above all of
              them) — it projects the impact of a plan change, which only
              makes sense to reach for once someone knows their current
              standing, not as the first thing they see. Still gated on
              having a Gap Analysis, since it has nothing to project from
              otherwise. */}
          {latestAnalysis && <WhatIfSimulator />}

          <DashboardSection label={t("sectionDevelopment")}>
            {(plans ?? []).map((plan) => (
              <PlanSummaryCard
                key={plan.id}
                plan={plan}
                milestones={(milestones ?? []).filter((m) => m.plan_id === plan.id)}
              />
            ))}
            <NewPlanForm
              subscriptionTier={effectiveSubscriptionTier(profile ?? null, !!membership)}
              existingPlanCount={(plans ?? []).length}
              personalization={{
                location: profile?.location ?? "",
                learningPreferences: profile?.learning_preferences ?? [],
                careerStage: profile?.career_stage ?? "",
                accommodation: profile?.accommodation ?? "",
                resourceTier: profile?.resource_tier ?? "",
              }}
            />
          </DashboardSection>

          {effectiveSubscriptionTier(profile ?? null, !!membership) === "free" && !profile?.upgrade_prompt_dismissed && (
            <DismissibleUpgradePrompt>
              <UpgradeToPremiumCard />
              <PremiumTrialForm />
              <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
                {t("studentPrefix")}{" "}
                <a href="mailto:sales@devometrics.com" style={{ color: "var(--teal)" }}>
                  {t("studentLink")}
                </a>{" "}
                {t("studentSuffix")}
              </p>
            </DismissibleUpgradePrompt>
          )}

          {membership?.role === "member" && (
            <DashboardSection label={t("sectionCompany")}>
              <CompanyMembershipCard organizationName={membership.organization_name} />
            </DashboardSection>
          )}

          <DashboardSection label={t("sectionAccount")}>
            <Link
              href="/dashboard/profile"
              style={{
                display: "block",
                background: "var(--navy-mid)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                padding: "16px 20px",
                textDecoration: "none",
              }}
            >
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{t("profileLinkTitle")}</p>
              <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
                {t("profileLinkSubtitle")}
              </p>
            </Link>
            <DataPrivacy
              pendingDataDeletionAt={profile?.pending_data_deletion_at ?? null}
              organizationName={membership?.organization_name ?? null}
            />
          </DashboardSection>
        </div>

        <StatRail
          stats={[
            {
              label: t("statCareerHealth"),
              value: compositeScore !== null ? `${compositeScore}` : "—",
              href: "/dashboard/gap-analysis",
              color: careerHealthColor,
            },
            {
              label: t("statCurrentStreak"),
              value: `${streakResult?.currentStreak ?? 0}d`,
            },
            {
              label: t("statTasksToday"),
              value: `${pendingTasksToday}`,
              href: "/dashboard/tasks",
              color: pendingTasksToday > 0 ? "var(--amber)" : undefined,
            },
            {
              label: t("statNextDeadline"),
              value: nextDeadline?.target_date
                ? new Date(nextDeadline.target_date).toLocaleDateString(dateLocale, { month: "short", day: "numeric" })
                : t("noneSet"),
              href: "/dashboard/tasks",
            },
          ]}
        />
      </div>
    </div>
  );
}
