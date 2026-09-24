import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { hasCompensationAccess } from "@/lib/organizations/compensationAccess";
import {
  listSalaryBands,
  listCompensationTerminology,
  listOrgCompensation,
  listCompensationProposals,
  getCompensationManagerVisibility,
} from "@/lib/compensation/actions";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import CompensationAdminDashboard from "@/components/dashboard/CompensationAdminDashboard";

export const metadata = { title: "Compensation — Devometrics" };

// Deliberately gates on hasCompensationAccess, NOT data.isOrgAdmin — the one
// page in /dashboard/company/* that doesn't follow the usual admin gate. See
// the build plan's permission matrix: an org admin without a Compensation
// Admin grant gets zero access here, same as any other employee.
export default async function CompanyCompensationPage() {
  const t = await getTranslations("companyCompensationPage");
  const data = await buildCompanyData();
  if (!data.organizationId) redirect("/dashboard");

  const supabase = await createClient();
  const canAccess = await hasCompensationAccess(supabase, data.organizationId);
  if (!canAccess) redirect("/dashboard/company");

  const [bands, terminology, roster, proposals, managerVisibility] = await Promise.all([
    listSalaryBands(data.organizationId),
    listCompensationTerminology(data.organizationId),
    listOrgCompensation(data.organizationId),
    listCompensationProposals(data.organizationId),
    getCompensationManagerVisibility(data.organizationId),
  ]);

  const employeeNames = Object.fromEntries(data.rows.map((r) => [r.userId, { name: r.name, email: r.email }]));
  const employees = data.rows.map((r) => ({ userId: r.userId, name: r.name, email: r.email }));

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{t("title")}</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>{t("description")}</p>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 10, fontStyle: "italic" }}>{t("notPayrollNote")}</p>
        </div>

        <CompanyNavTabs active="compensation" />

        <CompensationAdminDashboard
          organizationId={data.organizationId}
          initialBands={bands}
          initialTerminology={Array.from(terminology.entries())}
          initialRoster={roster}
          initialProposals={proposals}
          employeeNames={employeeNames}
          employees={employees}
          initialManagerVisibility={managerVisibility}
        />
      </div>
    </div>
  );
}
