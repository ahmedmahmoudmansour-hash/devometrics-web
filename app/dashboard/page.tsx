import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlanCard from "@/components/dashboard/PlanCard";
import NewPlanForm from "@/components/dashboard/NewPlanForm";
import ProfileSettings from "@/components/dashboard/ProfileSettings";
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
import { recordDailyActivity } from "@/lib/engagement/streak";
import { syncAchievements } from "@/lib/achievements/evaluate";
import { computeCompositeScore } from "@/lib/dashboard/compositeScore";
import { recordAndComputeMomentum } from "@/lib/momentum/momentum";
import { listMySurveys } from "@/lib/surveys/actions";
import { listTodayTasks } from "@/lib/tasks/actions";
import TodayTasksCard from "@/components/dashboard/TodayTasksCard";
import UpcomingDeadlinesCard from "@/components/dashboard/UpcomingDeadlinesCard";
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

  const streakResult = await recordDailyActivity();
  const todayTasks = await listTodayTasks();
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

  const onboardingSteps = [
    {
      label: "Tell us about yourself",
      description: "5 quick questions so your AI Coach and plans start from real context, not a cold start.",
      href: "/dashboard/discovery",
      done: !!discoveryProfile,
    },
    {
      label: "Take an assessment",
      description: "See where you stand on one competency — backed by real scenarios, not just a self-rating.",
      href: "/dashboard/assessments",
      done: latestScoreBySlug.size > 0,
    },
    {
      label: "Run your Gap Analysis",
      description: "Upload your CV and a target role — see exactly which skills stand between you and it.",
      href: "/dashboard/gap-analysis",
      done: !!latestAnalysis,
    },
    {
      label: "Get your development plan",
      description: "A prioritized, paced plan to close your biggest gaps first — not a generic checklist.",
      href: "/dashboard/gap-analysis",
      done: (plans ?? []).length > 0,
    },
    {
      label: "Check your resume",
      description: "Find out what's quietly costing you interviews before a recruiter does. Optional.",
      href: "/dashboard/resume",
      done: !!latestResume,
    },
  ];

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <WelcomeModal
        name={profile?.full_name?.trim().split(/\s+/)[0] ?? null}
        role={membership?.role === "admin" ? "admin" : membership ? "member" : null}
      />
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>Your progress</h1>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <OnboardingChecklist steps={onboardingSteps} />
          <UpcomingDeadlinesCard milestones={milestones ?? []} />
          <TodayTasksCard tasks={todayTasks} />
          <KeyTrendsCard jobTitle={profile?.job_history?.[0]?.title ?? null} />
          <PendingSurveysCard surveys={mySurveys} />
          <CareerHealthOverview
            gapAnalysisScore={latestAnalysis?.career_health_score ?? null}
            assessmentAverage={assessmentAverage}
            resumeScore={latestResume?.overall_score ?? null}
          />
          <CareerMomentumCard momentum={momentum} />
          <AchievementsCard earnedKeys={earnedAchievements} badgesEnabled={profile?.badges_enabled ?? true} />
          {(plans ?? []).map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              milestones={(milestones ?? []).filter((m) => m.plan_id === plan.id)}
            />
          ))}
          <ProfileSettings profile={profile} />
          <NewPlanForm
            subscriptionTier={effectiveSubscriptionTier(profile ?? null)}
            existingPlanCount={(plans ?? []).length}
          />
          {effectiveSubscriptionTier(profile ?? null) === "free" && <UpgradeToPremiumCard />}
          {effectiveSubscriptionTier(profile ?? null) === "free" && <PremiumTrialForm />}
          {effectiveSubscriptionTier(profile ?? null) === "free" && (
            <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
              Student?{" "}
              <a href="mailto:sales@devometrics.com" style={{ color: "var(--teal)" }}>
                Email sales@devometrics.com
              </a>{" "}
              for a discount.
            </p>
          )}
          {membership?.role === "member" && (
            <CompanyMembershipCard organizationName={membership.organization_name} />
          )}
          <DataPrivacy />
        </div>
      </div>
    </div>
  );
}
