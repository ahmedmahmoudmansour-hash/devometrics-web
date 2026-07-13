import Link from "next/link";
import { redirect } from "next/navigation";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import OrganizationCompetencyBuilder from "@/components/dashboard/OrganizationCompetencyBuilder";

export default async function CompanyCompetenciesPage() {
  const data = await buildCompanyData();
  if (!data.isOrgAdmin) redirect("/dashboard");

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to progress
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {data.organizationName}
          </h1>
        </div>

        <CompanyNavTabs active="competencies" />

        {data.organizationId && (
          <OrganizationCompetencyBuilder
            organizationId={data.organizationId}
            competencies={data.organizationCompetencies}
            dimensionAverages={data.dimensionAverages}
          />
        )}
      </div>
    </div>
  );
}
