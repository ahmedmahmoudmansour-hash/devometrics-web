import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import JobArchitectureManager from "@/components/dashboard/JobArchitectureManager";
import type { JobFamily, JobRole, RoleCompetencyRequirement, RoleTransition } from "@/lib/supabase/types";

export const metadata = { title: "Job Architecture — Devometrics" };

export default async function JobArchitecturePage() {
  const t = await getTranslations("jobArchitecturePage");
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) redirect("/dashboard");

  const supabase = await createClient();

  // All four reads are additive tables (migration 0067) — a query error
  // before it's run yields null, which the client renders as an empty,
  // "run the migration" state rather than crashing the page.
  const [{ data: families, error }, { data: roles }, { data: requirements }, { data: transitions }] = await Promise.all([
    supabase.from("job_families").select("*").eq("organization_id", data.organizationId).order("name").returns<JobFamily[]>(),
    supabase.from("job_roles").select("*").eq("organization_id", data.organizationId).order("grade", { ascending: false }).returns<JobRole[]>(),
    supabase.from("role_competency_requirements").select("*").eq("organization_id", data.organizationId).returns<RoleCompetencyRequirement[]>(),
    supabase.from("role_transitions").select("*").eq("organization_id", data.organizationId).returns<RoleTransition[]>(),
  ]);

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div className="dashboard-wide-content">
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {t("title")}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 680 }}>
            {t("description")}
          </p>
        </div>

        <CompanyNavTabs active="jobArchitecture" />

        {error ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", padding: 28, borderRadius: 16 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
              {t.rich("migrationNotEnabled", {
                code: (chunks) => <code style={{ color: "var(--teal)" }}>{chunks}</code>,
              })}
            </p>
          </div>
        ) : (
          <JobArchitectureManager
            families={families ?? []}
            roles={roles ?? []}
            requirements={requirements ?? []}
            transitions={transitions ?? []}
          />
        )}
      </div>
    </div>
  );
}
