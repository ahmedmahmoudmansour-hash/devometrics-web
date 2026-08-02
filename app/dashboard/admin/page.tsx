import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buildPilotRows } from "@/lib/admin/aggregate";
import { buildAdminOrganizations } from "@/lib/admin/organizations";
import AdminOrganizationsTable from "@/components/dashboard/AdminOrganizationsTable";
import AdminPilotTable from "@/components/dashboard/AdminPilotTable";
import CreateCompanyWorkspaceForm from "@/components/dashboard/CreateCompanyWorkspaceForm";

export default async function AdminPage() {
  const t = await getTranslations("adminPage");
  const [{ isAdmin, rows }, { rows: orgRows }] = await Promise.all([buildPilotRows(), buildAdminOrganizations()]);
  if (!isAdmin) redirect("/dashboard");

  const withScore = rows.filter((r) => r.careerHealthScore !== null);
  const avgScore = withScore.length
    ? Math.round(withScore.reduce((s, r) => s + (r.careerHealthScore ?? 0), 0) / withScore.length)
    : null;

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
              {t("backToProgress")}
            </Link>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
              {t("title")}
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              {t("participantsCount", { count: rows.length })}
              {avgScore !== null ? t("avgScoreSuffix", { score: avgScore }) : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link
              href="/dashboard/admin/inquiries"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text)",
                textDecoration: "none",
              }}
            >
              {t("contactInquiries")}
            </Link>
            <a
              href="/api/admin/export/xlsx"
              style={{
                background: "var(--teal)",
                color: "#0A0F1E",
                border: "none",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              {t("exportToExcel")}
            </a>
          </div>
        </div>

        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
          {t("scopeNotice")}
        </p>

        <CreateCompanyWorkspaceForm />

        <AdminOrganizationsTable initial={orgRows} />

        <AdminPilotTable initial={rows} />
      </div>
    </div>
  );
}
