import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import ManageRoleAssessments from "@/components/assessment/ManageRoleAssessments";
import { listManagedRoleAssessments, purgeExpiredRoleAssessmentAnswers } from "@/lib/assessment/actions";
import ManageKnowledgeChecks from "@/components/knowledgeCheck/ManageKnowledgeChecks";
import { listManagedKnowledgeChecks } from "@/lib/knowledgeBank/actions";

export const metadata = { title: "Role assessments — Devometrics" };
export const maxDuration = 120;

export default async function CompanyRoleAssessmentsPage() {
  const t = await getTranslations("roleAssessment");
  const tk = await getTranslations("knowledgeCheck");
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) redirect("/dashboard");

  await purgeExpiredRoleAssessmentAnswers();
  const managed = await listManagedRoleAssessments();
  const knowledge = await listManagedKnowledgeChecks();

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("back")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{t("manageTitle")}</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 680 }}>{t("manageIntro")}</p>
        </div>
        <CompanyNavTabs active="roleAssessments" />
        {"error" in managed ? (
          <p style={{ color: "var(--danger)", fontSize: 13 }}>{managed.error}</p>
        ) : (
          <ManageRoleAssessments rows={managed.rows} names={managed.names} employees={managed.employees} roles={managed.roles} viewer={managed.viewer} settings={managed.settings} />
        )}
        {!("error" in knowledge) && knowledge.ready && (
          <div style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{tk("title")}</h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6, maxWidth: 680 }}>{tk("intro")}</p>
            <ManageKnowledgeChecks rows={knowledge.rows} names={knowledge.names} employees={knowledge.employees} roles={knowledge.roles} isAdmin={knowledge.isAdmin} ready={knowledge.ready} />
          </div>
        )}
      </div>
    </div>
  );
}
