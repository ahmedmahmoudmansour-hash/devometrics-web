import Link from "next/link";
import { redirect } from "next/navigation";
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
  const data = await buildCompanyData();
  if (!data.isOrgAdmin) redirect("/dashboard");

  let widgets: CompanyWidget[] = [];
  if (data.organizationId) {
    const supabase = await createClient();
    const [jobRoleCount, successionRoleCount, scorecardKpiCount, surveyCount] = await Promise.all([
      countOrNull(supabase, "job_roles", data.organizationId),
      countOrNull(supabase, "succession_roles", data.organizationId),
      countOrNull(supabase, "scorecard_kpis", data.organizationId),
      countOrNull(supabase, "surveys", data.organizationId),
    ]);

    const hipoCount = data.rows.filter((r) => {
      const point = computeNineBoxPoint(r.dimensionLevels);
      return point ? zoneForPoint(point.x, point.y).row === 2 : false;
    }).length;

    widgets = [
      {
        key: "employees",
        label: "Employees",
        href: "/dashboard/company/employees",
        icon: COMPANY_WIDGET_ICONS.Users,
        stat: `${data.rows.length} team member${data.rows.length === 1 ? "" : "s"}`,
      },
      {
        key: "jobArchitecture",
        label: "Job Architecture",
        href: "/dashboard/company/job-architecture",
        icon: COMPANY_WIDGET_ICONS.Network,
        stat: jobRoleCount !== null ? `${jobRoleCount} role${jobRoleCount === 1 ? "" : "s"} defined` : "Define families & graded roles",
      },
      {
        key: "orgChart",
        label: "Org Chart",
        href: "/dashboard/company/org-chart",
        icon: COMPANY_WIDGET_ICONS.ListTree,
        stat: `${data.rows.filter((r) => r.managerUserId).length}/${data.rows.length} have a manager set`,
      },
      {
        key: "competencies",
        label: "Competencies",
        href: "/dashboard/company/competencies",
        icon: COMPANY_WIDGET_ICONS.SlidersHorizontal,
        stat: `${data.organizationCompetencies.length} custom competenc${data.organizationCompetencies.length === 1 ? "y" : "ies"}`,
      },
      {
        key: "analytics",
        label: "Analytics",
        href: "/dashboard/company/analytics",
        icon: COMPANY_WIDGET_ICONS.BarChart3,
        stat: "Workforce skill heatmap & talent grid",
      },
      {
        key: "highPotential",
        label: "High Potential",
        href: "/dashboard/company/high-potential",
        icon: COMPANY_WIDGET_ICONS.Star,
        stat: `${hipoCount} in the pool`,
      },
      {
        key: "succession",
        label: "Succession",
        href: "/dashboard/company/succession",
        icon: COMPANY_WIDGET_ICONS.TrendingUp,
        stat: successionRoleCount !== null ? `${successionRoleCount} critical role${successionRoleCount === 1 ? "" : "s"} tracked` : "Rank candidates for critical roles",
      },
      {
        key: "scorecard",
        label: "Scorecard",
        href: "/dashboard/company/scorecard",
        icon: COMPANY_WIDGET_ICONS.Gauge,
        stat: scorecardKpiCount !== null ? `${scorecardKpiCount} KPI${scorecardKpiCount === 1 ? "" : "s"} tracked` : "Balanced Scorecard, 4 perspectives",
      },
      {
        key: "surveys",
        label: "Surveys",
        href: "/dashboard/company/surveys",
        icon: COMPANY_WIDGET_ICONS.MessageSquare,
        stat: surveyCount !== null ? `${surveyCount} survey${surveyCount === 1 ? "" : "s"}` : "Anonymous pulse surveys",
      },
    ];
  }

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to progress
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
          Only your own company&apos;s members appear here — this is scoped to your organization, not
          a shared pilot-wide view. Everyone below uses the exact same individual tools as any other
          Devometrics account; this dashboard just aggregates what they&apos;ve already done.
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
