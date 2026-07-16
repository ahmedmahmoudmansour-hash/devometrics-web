import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import JobArchitectureManager from "@/components/dashboard/JobArchitectureManager";
import type { JobFamily, JobRole, RoleCompetencyRequirement, RoleTransition } from "@/lib/supabase/types";

export const metadata = { title: "Job Architecture — Devometrics" };

export default async function JobArchitecturePage() {
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
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to progress
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            Job Architecture
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 680 }}>
            Define your functional families, the roles within them, and each role&apos;s grade and
            required competency profile — the structural spine that turns &quot;development needed&quot;
            into a real gap against a real role, and powers vertical and horizontal career paths. AI
            can propose a grade and competency profile from a role&apos;s responsibilities; you review
            and edit before saving.
          </p>
        </div>

        <CompanyNavTabs active="jobArchitecture" />

        {error ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", padding: 28, borderRadius: 16 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
              Job Architecture isn&apos;t enabled on this database yet — the{" "}
              <code style={{ color: "var(--teal)" }}>0067_job_architecture.sql</code> migration needs
              to be run in the Supabase SQL Editor first.
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
