import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { buildCompanyOverview } from "@/lib/organizations/companyOverview";
import { attentionFlagText } from "@/lib/organizations/attentionText";
import { createClient } from "@/lib/supabase/server";
import { computeNineBoxPoint, zoneForPoint } from "@/lib/organizations/nineBox";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import InviteEmployeeForm from "@/components/dashboard/InviteEmployeeForm";
import OrganizationProfileForm from "@/components/dashboard/OrganizationProfileForm";
import OrganizationContactsForm from "@/components/dashboard/OrganizationContactsForm";
import OrganizationBrandingForm from "@/components/dashboard/OrganizationBrandingForm";
import EmailMessagesForm from "@/components/dashboard/EmailMessagesForm";
import DeleteCompanyButton from "@/components/dashboard/DeleteCompanyButton";
import InviteCodeDisplay from "@/components/dashboard/InviteCodeDisplay";
import CompanyWidgetGrid, { COMPANY_WIDGET_ICONS, type CompanyWidget } from "@/components/dashboard/CompanyWidgetGrid";
import CompanySetupGuide, { type SetupGuideStep } from "@/components/dashboard/CompanySetupGuide";
import AutomationSettingsPanel from "@/components/dashboard/AutomationSettingsPanel";
import { getAutomationSettings } from "@/lib/automations/actions";
import { getOrganizationEmailMessages } from "@/lib/organizations/emailMessages";

// Live counts for the widget grid — each an isolated, defensive count query
// (head:true, no rows fetched) against a table that may belong to a
// migration that hasn't run yet. A missing table just yields a null count,
// which renders as a generic description instead of a number rather than
// breaking the page — same graceful-degrade posture as every other
// isolated query in this codebase.
async function countOrNull(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  organizationId: string
): Promise<number | null> {
  const { count } = await supabase.from(table).select("*", { count: "exact", head: true }).eq("organization_id", organizationId);
  return count ?? null;
}

export default async function CompanyProfilePage() {
  const t = await getTranslations("companyProfilePage");
  const tDim = await getTranslations("competencyDimensions");
  const tNav = await getTranslations("companyNavTabs");
  const data = await buildCompanyData();
  if (!data.isOrgAdmin) redirect("/dashboard");
  const overview = await buildCompanyOverview(data);
  const automationSettings = data.organizationId ? await getAutomationSettings(data.organizationId) : null;
  const emailMessages = data.organizationId ? await getOrganizationEmailMessages(data.organizationId) : null;

  let widgets: CompanyWidget[] = [];
  let setupSteps: SetupGuideStep[] = [];
  if (data.organizationId) {
    const supabase = await createClient();
    const [jobRoleCount, successionRoleCount, scorecardKpiCount, surveyCount, reviewCycleCount, knowledgeHubContentCount, jobPostingCount, exitInterviewCount] = await Promise.all([
      countOrNull(supabase, "job_roles", data.organizationId),
      countOrNull(supabase, "succession_roles", data.organizationId),
      countOrNull(supabase, "scorecard_kpis", data.organizationId),
      countOrNull(supabase, "surveys", data.organizationId),
      countOrNull(supabase, "performance_review_cycles", data.organizationId),
      countOrNull(supabase, "knowledge_hub_content", data.organizationId),
      countOrNull(supabase, "job_postings", data.organizationId),
      countOrNull(supabase, "exit_interviews", data.organizationId),
    ]);

    const hipoCount = data.rows.filter((r) => {
      const point = computeNineBoxPoint(r.dimensionLevels);
      return point ? zoneForPoint(point.x, point.y).row === 2 : false;
    }).length;

    const withManager = data.rows.filter((r) => r.managerUserId).length;

    // "Account created" (step 1) is implicit — an org admin exists by
    // definition of reaching this page. "Add employees" (step 2) checks
    // for more than just the admin's own row (data.rows always includes
    // the admin themselves), not merely rows.length > 0, so a freshly
    // created org never shows this step as already done.
    setupSteps = [
      { key: "account", href: "/dashboard/company", done: true },
      { key: "employees", href: "/dashboard/company/employees", done: data.rows.length > 1 || data.pendingInvites.length > 0 },
      { key: "structure", href: "/dashboard/company/org-chart", done: withManager > 0 },
      { key: "competencies", href: "/dashboard/company/competencies", done: data.organizationCompetencies.length > 0 },
      { key: "jobDescriptions", href: "/dashboard/company/job-architecture", done: !!jobRoleCount && jobRoleCount > 0 },
    ];

    // Same order as CompanyNavTabs' 5 groups (Overview, Structure, Talent,
    // Hiring & Growth, Performance & Feedback) — this grid used to be in an
    // unrelated ad-hoc order, which read as inconsistent with the nav
    // directly above it. Profile and Permissions are deliberately not
    // tiles here (Profile IS this page; Permissions is a config screen,
    // not a feature with its own stat to show), same reasoning as before.
    widgets = [
      // Overview
      {
        key: "employees",
        label: t("employeesLabel"),
        href: "/dashboard/company/employees",
        icon: COMPANY_WIDGET_ICONS.Users,
        stat: t("employeesStat", { count: data.rows.length }),
        group: tNav("groupOverview"),
      },
      {
        key: "analytics",
        label: t("analyticsLabel"),
        href: "/dashboard/company/analytics",
        icon: COMPANY_WIDGET_ICONS.BarChart3,
        stat: t("analyticsStat"),
        group: tNav("groupOverview"),
      },
      // Structure
      {
        key: "orgChart",
        label: t("orgChartLabel"),
        href: "/dashboard/company/org-chart",
        icon: COMPANY_WIDGET_ICONS.ListTree,
        stat: t("orgChartStat", { withManager, total: data.rows.length }),
        group: tNav("groupStructure"),
      },
      {
        key: "jobArchitecture",
        label: t("jobArchitectureLabel"),
        href: "/dashboard/company/job-architecture",
        icon: COMPANY_WIDGET_ICONS.Network,
        stat: jobRoleCount !== null ? t("jobArchitectureStat", { count: jobRoleCount }) : t("jobArchitectureStatEmpty"),
        group: tNav("groupStructure"),
      },
      {
        key: "competencies",
        label: t("competenciesLabel"),
        href: "/dashboard/company/competencies",
        icon: COMPANY_WIDGET_ICONS.SlidersHorizontal,
        stat: t("competenciesStat", { count: data.organizationCompetencies.length }),
        group: tNav("groupStructure"),
      },
      // Talent
      {
        key: "highPotential",
        label: t("highPotentialLabel"),
        href: "/dashboard/company/high-potential",
        icon: COMPANY_WIDGET_ICONS.Star,
        stat: t("highPotentialStat", { count: hipoCount }),
        group: tNav("groupTalent"),
      },
      {
        key: "succession",
        label: t("successionLabel"),
        href: "/dashboard/company/succession",
        icon: COMPANY_WIDGET_ICONS.TrendingUp,
        stat: successionRoleCount !== null ? t("successionStat", { count: successionRoleCount }) : t("successionStatEmpty"),
        group: tNav("groupTalent"),
      },
      {
        key: "scorecard",
        label: t("scorecardLabel"),
        href: "/dashboard/company/scorecard",
        icon: COMPANY_WIDGET_ICONS.Gauge,
        stat: scorecardKpiCount !== null ? t("scorecardStat", { count: scorecardKpiCount }) : t("scorecardStatEmpty"),
        group: tNav("groupTalent"),
      },
      // Hiring & Growth
      {
        key: "hiring",
        label: t("hiringLabel"),
        href: "/dashboard/company/hiring",
        icon: COMPANY_WIDGET_ICONS.Briefcase,
        stat: jobPostingCount !== null ? t("hiringStat", { count: jobPostingCount }) : t("hiringStatEmpty"),
        group: tNav("groupHiringGrowth"),
      },
      {
        key: "knowledgeHub",
        label: t("knowledgeHubLabel"),
        href: "/dashboard/company/knowledge-hub",
        icon: COMPANY_WIDGET_ICONS.Library,
        stat:
          knowledgeHubContentCount !== null
            ? t("knowledgeHubStat", { count: knowledgeHubContentCount })
            : t("knowledgeHubStatEmpty"),
        group: tNav("groupHiringGrowth"),
      },
      // Performance & Feedback
      {
        key: "performanceReviews",
        label: t("performanceReviewsLabel"),
        href: "/dashboard/company/impact-cycles",
        icon: COMPANY_WIDGET_ICONS.ClipboardCheck,
        stat: reviewCycleCount !== null ? t("performanceReviewsStat", { count: reviewCycleCount }) : t("performanceReviewsStatEmpty"),
        group: tNav("groupPerformanceFeedback"),
      },
      {
        key: "surveys",
        label: t("surveysLabel"),
        href: "/dashboard/company/surveys",
        icon: COMPANY_WIDGET_ICONS.MessageSquare,
        stat: surveyCount !== null ? t("surveysStat", { count: surveyCount }) : t("surveysStatEmpty"),
        group: tNav("groupPerformanceFeedback"),
      },
      {
        key: "exitInterviews",
        label: t("exitInterviewsLabel"),
        href: "/dashboard/company/exit-interviews",
        icon: COMPANY_WIDGET_ICONS.UserMinus,
        stat: exitInterviewCount !== null ? t("exitInterviewsStat", { count: exitInterviewCount }) : t("exitInterviewsStatEmpty"),
        group: tNav("groupPerformanceFeedback"),
      },
    ];
  }

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
            {data.organizationLogoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- customer-supplied external logo URL, not a static asset next/image can optimize meaningfully
              <img
                src={data.organizationLogoUrl}
                alt={`${data.organizationName} logo`}
                style={{ height: 28, width: "auto", borderRadius: 4 }}
              />
            )}
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>
              {data.organizationName}
            </h1>
          </div>
          {data.organizationSlug && <InviteCodeDisplay slug={data.organizationSlug} />}
        </div>

        <CompanyNavTabs active="profile" />

        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
          {t("scopeNote")}
        </p>

        {setupSteps.length > 0 && <CompanySetupGuide steps={setupSteps} />}

        {data.organizationId && data.rows.length > 0 && (
          <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                background: "var(--navy-mid)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                padding: 22,
                display: "flex",
                gap: 28,
                flexWrap: "wrap",
              }}
            >
              <div>
                <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>{data.rows.length}</p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t("overviewTeamSize")}</p>
              </div>
              {data.companyCareerHealthScore !== null && (
                <div>
                  <p style={{ fontSize: 26, fontWeight: 800, color: "var(--teal)" }}>{data.companyCareerHealthScore}</p>
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t("companyCareerHealth")}</p>
                </div>
              )}
              <div>
                <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>{overview.hiring.openPostings}</p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t("overviewOpenPostings")}</p>
              </div>
              <div>
                <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>{overview.hiring.totalCandidates}</p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t("overviewCandidatesInPipeline")}</p>
              </div>
              <div>
                <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>{overview.hiring.totalHired}</p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t("overviewHired")}</p>
              </div>
            </div>

            {overview.attention.length > 0 && (
              <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>{t("overviewAttentionTitle")}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {overview.attention.map((flag, i) => (
                    <Link
                      key={i}
                      href={flag.href}
                      style={{ display: "flex", alignItems: "flex-start", gap: 10, textDecoration: "none" }}
                    >
                      <span
                        style={{
                          flexShrink: 0,
                          marginTop: 5,
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: flag.severity === "warning" ? "var(--amber)" : "var(--teal)",
                        }}
                      />
                      <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>
                        {attentionFlagText(t, tDim, flag)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {(data.leadershipReadiness.length > 0 || overview.surveys.length > 0) && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                {data.leadershipReadiness.length > 0 && (
                  <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{t("overviewLeadershipReadiness")}</p>
                    <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>{t("overviewLeadershipReadinessHint")}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {data.leadershipReadiness.slice(0, 5).map((r) => (
                        <Link
                          key={r.userId}
                          href={`/dashboard/company/${r.userId}`}
                          style={{ display: "flex", justifyContent: "space-between", fontSize: 13, textDecoration: "none" }}
                        >
                          <span style={{ color: "var(--text)" }}>{r.name}</span>
                          <span className="mono" style={{ color: "var(--teal)", fontWeight: 700 }}>{r.score}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {overview.surveys.length > 0 && (
                  <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>{t("overviewSurveyParticipation")}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {overview.surveys.slice(0, 5).map((s) => (
                        <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                          <span style={{ color: "var(--text)" }}>{s.title}</span>
                          <span className="mono" style={{ color: "var(--text-muted)", fontWeight: 600 }}>
                            {s.responseCount ?? 0}/{s.assignedCount}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {widgets.length > 0 && <CompanyWidgetGrid widgets={widgets} />}

        {data.organizationId && automationSettings && (
          <AutomationSettingsPanel organizationId={data.organizationId} initialSettings={automationSettings} />
        )}

        {data.organizationId && (
          <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 24 }}>
            <InviteEmployeeForm organizationId={data.organizationId} pendingInvites={data.pendingInvites} />
            <OrganizationProfileForm
              organizationId={data.organizationId}
              initial={{
                website: data.organizationWebsite,
                employeeCount: data.organizationEmployeeCount,
                industry: data.organizationIndustry,
              }}
            />
            <OrganizationContactsForm
              organizationId={data.organizationId}
              initial={{
                platformContactName: data.organizationPlatformContactName,
                platformContactEmail: data.organizationPlatformContactEmail,
                financeContactName: data.organizationFinanceContactName,
                financeContactEmail: data.organizationFinanceContactEmail,
              }}
            />
            <OrganizationBrandingForm
              organizationId={data.organizationId}
              initial={{ logoUrl: data.organizationLogoUrl, brandColor: data.organizationBrandColor }}
            />
            {emailMessages && <EmailMessagesForm organizationId={data.organizationId} initial={emailMessages} />}
          </div>
        )}

        {data.organizationId && (
          <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
            <DeleteCompanyButton
              organizationId={data.organizationId}
              organizationName={data.organizationName ?? "this workspace"}
              pendingDeletionAt={data.organizationPendingDeletionAt}
            />
          </div>
        )}
      </div>
    </div>
  );
}
