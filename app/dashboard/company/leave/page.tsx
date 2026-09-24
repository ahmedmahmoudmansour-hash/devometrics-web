import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { listLeaveTypes, listOrgLeaveBalances, listOrgLeaveRequests, getLeaveManagerVisibility, listLeaveTypeEligibility } from "@/lib/leave/actions";
import { listOrgHrLetterRequests } from "@/lib/hrLetters/actions";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import LeaveAdminDashboard from "@/components/dashboard/LeaveAdminDashboard";

export const metadata = { title: "Leave — Devometrics" };

// Normal isOrgAdmin gate — unlike Compensation, leave data doesn't need a
// narrower permission than "is an admin of this company" (see 0166's
// header for why it uses normal RLS instead of compensation's RPC-only
// lockdown).
export default async function CompanyLeavePage() {
  const t = await getTranslations("companyLeavePage");
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) redirect("/dashboard");

  const currentYear = new Date().getFullYear();
  const [leaveTypes, balances, requests, hrLetterRequests, managerVisibility, leaveTypeEligibility] = await Promise.all([
    listLeaveTypes(data.organizationId),
    listOrgLeaveBalances(data.organizationId, currentYear),
    listOrgLeaveRequests(data.organizationId),
    listOrgHrLetterRequests(data.organizationId),
    getLeaveManagerVisibility(data.organizationId),
    listLeaveTypeEligibility(data.organizationId),
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
        </div>

        <CompanyNavTabs active="leave" />

        <LeaveAdminDashboard
          organizationId={data.organizationId}
          currentYear={currentYear}
          initialLeaveTypes={leaveTypes}
          initialBalances={balances}
          initialRequests={requests}
          initialHrLetterRequests={hrLetterRequests}
          initialManagerVisibility={managerVisibility}
          leaveTypeEligibility={leaveTypeEligibility}
          employeeNames={employeeNames}
          employees={employees}
        />
      </div>
    </div>
  );
}
