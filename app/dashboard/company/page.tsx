import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { createClient } from "@/lib/supabase/server";
import { computeNineBoxPoint, zoneForPoint } from "@/lib/organizations/nineBox";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import InviteEmployeeForm from "@/components/dashboard/InviteEmployeeForm";
import OrganizationProfileForm from "@/components/dashboard/OrganizationProfileForm";
import OrganizationContactsForm from "@/components/dashboard/OrganizationContactsForm";
import OrganizationBrandingForm from "@/components/dashboard/OrganizationBrandingForm";
import DeleteCompanyButton from "@/components/dashboard/DeleteCompanyButton";
import InviteCodeDisplay from "@/components/dashboard/InviteCodeDisplay";
import CompanyWidgetGrid, { COMPANY_WIDGET_ICONS, type CompanyWidget } from "@/components/dashboard/CompanyWidgetGrid";

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
  const data = await buildCompanyData();
  if (!data.isOrgAdmin) redirect("/dashboard");

  let widgets: CompanyWidget[] = [];
  if (data.organizationId) {
    const supabase = await createClient();
    const [jobRoleCount, successionRoleCount, scorecardKpiCount, surveyCount, reviewCycleCount, knowledgeHubContentCount, jobPostingCount] = await Promise.all([
      countOrNull(supabase, "job_roles", data.organizationId),
      countOrNull(supabase, "succession_roles", data.organizationId),
      countOrNull(supabase, "scorecard_kpis", data.organizationId),
      countOrNull(supabase, "surveys", data.organizationId),
      countOrNull(supabase, "performance_review_cycles", data.organizationId),
      countOrNull(supabase, "knowledge_hub_content", data.organizationId),
      countOrNull(supabase, "job_postings", data.organizationId),
    ]);

    const hipoCount = data.rows.filter((r) => {
      const point = computeNineBoxPoint(r.dimensionLevels);
      return point ? zoneForPoint(point.x, point.y).row === 2 : false;
    }).length;

    const withManager = data.rows.filter((r) => r.managerUserId).length;
    widgets = [
      {
        key: "employees",
        label: t("employeesLabel"),
        href: "/dashboard/company/employees",
        icon: COMPANY_WIDGET_ICONS.Users,
        stat: t("employeesStat", { count: data.rows.length }),
      },
      {
        key: "jobArchitecture",
        label: t("jobArchitectureLabel"),
        href: "/dashboard/company/job-architecture",
        icon: COMPANY_WIDGET_ICONS.Network,
        stat: jobRoleCount !== null ? t("jobArchitectureStat", { count: jobRoleCount }) : t("jobArchitectureStatEmpty"),
      },
      {
        key: "hiring",
        label: t("hiringLabel"),
        href: "/dashboard/company/hiring",
        icon: COMPANY_WIDGET_ICONS.Briefcase,
        stat: jobPostingCount !== null ? t("hiringStat", { count: jobPostingCount }) : t("hiringStatEmpty"),
      },
      {
        key: "orgChart",
        label: t("orgChartLabel"),
        href: "/dashboard/company/org-chart",
        icon: COMPANY_WIDGET_ICONS.ListTree,
        stat: t("orgChartStat", { withManager, total: data.rows.length }),
      },
      {
        key: "competencies",
        label: t("competenciesLabel"),
        href: "/dashboard/company/competencies",
        icon: COMPANY_WIDGET_ICONS.SlidersHorizontal,
        stat: t("competenciesStat", { count: data.organizationCompetencies.length }),
      },
      {
        key: "performanceReviews",
        label: t("performanceReviewsLabel"),
        href: "/dashboard/company/impact-cycles",
        icon: COMPANY_WIDGET_ICONS.ClipboardCheck,
        stat: reviewCycleCount !== null ? t("performanceReviewsStat", { count: reviewCycleCount }) : t("performanceReviewsStatEmpty"),
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
      },
      {
        key: "highPotential",
        label: t("highPotentialLabel"),
        href: "/dashboard/company/high-potential",
        icon: COMPANY_WIDGET_ICONS.Star,
        stat: t("highPotentialStat", { count: hipoCount }),
      },
      {
        key: "succession",
        label: t("successionLabel"),
        href: "/dashboard/company/succession",
        icon: COMPANY_WIDGET_ICONS.TrendingUp,
        stat: successionRoleCount !== null ? t("successionStat", { count: successionRoleCount }) : t("successionStatEmpty"),
      },
      {
        key: "scorecard",
        label: t("scorecardLabel"),
        href: "/dashboard/company/scorecard",
        icon: COMPANY_WIDGET_ICONS.Gauge,
        stat: scorecardKpiCount !== null ? t("scorecardStat", { count: scorecardKpiCount }) : t("scorecardStatEmpty"),
      },
      {
        key: "surveys",
        label: t("surveysLabel"),
        href: "/dashboard/company/surveys",
        icon: COMPANY_WIDGET_ICONS.MessageSquare,
        stat: surveyCount !== null ? t("surveysStat", { count: surveyCount }) : t("surveysStatEmpty"),
      },
      {
        key: "analytics",
        label: t("analyticsLabel"),
        href: "/dashboard/company/analytics",
        icon: COMPANY_WIDGET_ICONS.BarChart3,
        stat: t("analyticsStat"),
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

        {widgets.length > 0 && <CompanyWidgetGrid widgets={widgets} />}

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
