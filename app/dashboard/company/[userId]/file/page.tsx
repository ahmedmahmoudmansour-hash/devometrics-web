import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { getEmployeeFile, getDisabledFileSections } from "@/lib/employeeFile/actions";
import EmployeeFileEditor from "@/components/dashboard/EmployeeFileEditor";
import Avatar from "@/components/Avatar";

export const metadata = { title: "Employee file — Devometrics" };

// HR's view of one person's file. Admin-only, and RLS is the real gate: the
// file tables return nothing to anyone who isn't the person or an admin of
// their company. Opening someone else's file is recorded in the access log.
export default async function EmployeeFilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const t = await getTranslations("employeeFile");
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) redirect("/dashboard");

  const person = data.rows.find((r) => r.userId === userId);
  if (!person) redirect("/dashboard/company/employees");

  const [bundle, disabledSections] = await Promise.all([getEmployeeFile(data.organizationId, userId), getDisabledFileSections(data.organizationId)]);
  const inactive = person.employmentStatus !== "active";

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <Link href="/dashboard/company/employees" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
          {t("backToEmployees")}
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "14px 0 6px" }}>
          <Avatar name={person.name} avatarUrl={person.avatarUrl} size={48} />
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", margin: 0 }}>{person.name}</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "2px 0 0" }}>
              {[person.title, person.department, person.email].filter((v) => v && v !== "—").join(" · ")}
              <span
                style={{
                  marginInlineStart: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: inactive ? "rgba(255,255,255,0.08)" : "rgba(var(--teal-rgb),0.15)",
                  color: inactive ? "var(--text-muted)" : "var(--teal)",
                }}
              >
                {t(`status_${person.employmentStatus}`)}
              </span>
            </p>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.6, maxWidth: 640 }}>{t("hrPrivacyNote")}</p>

        <EmployeeFileEditor mode="hr" organizationId={data.organizationId} userId={userId} initial={bundle} disabledSections={disabledSections} />
      </div>
    </div>
  );
}
