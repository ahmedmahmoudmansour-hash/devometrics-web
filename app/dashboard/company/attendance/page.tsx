import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { listAttendanceForMonth } from "@/lib/attendance/actions";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import AttendanceAdminView from "@/components/dashboard/AttendanceAdminView";
import AttendanceImportSection from "@/components/dashboard/AttendanceImportSection";

export const metadata = { title: "Attendance — Devometrics" };

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Admin-only overview of a month of attendance, plus the spreadsheet import.
// RLS is the real gate (attendance_records: admins see the whole company).
export default async function CompanyAttendancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const t = await getTranslations("attendanceAdmin");
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) redirect("/dashboard");

  const { month: requested } = await searchParams;
  const now = new Date();
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const month = requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : currentMonth;

  const records = await listAttendanceForMonth(data.organizationId, month);
  const employees = data.rows.map((r) => ({ userId: r.userId, name: r.name }));

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard/company" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToCompany")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{t("title")}</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>{t("description")}</p>
        </div>

        <CompanyNavTabs active="attendance" />

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <Link href={`?month=${shiftMonth(month, -1)}`} style={{ color: "var(--teal)", textDecoration: "none", fontSize: 14 }}>
            ←
          </Link>
          <strong style={{ fontSize: 15, color: "var(--text)" }}>{month}</strong>
          <Link href={`?month=${shiftMonth(month, 1)}`} style={{ color: "var(--teal)", textDecoration: "none", fontSize: 14 }}>
            →
          </Link>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <AttendanceImportSection organizationId={data.organizationId} />
          <AttendanceAdminView key={month} records={records} employees={employees} />
        </div>
      </div>
    </div>
  );
}
