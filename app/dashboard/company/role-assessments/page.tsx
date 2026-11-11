import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import AssessmentsManager from "@/components/assessment/AssessmentsManager";
import { listManagedRoleAssessments, purgeExpiredRoleAssessmentAnswers } from "@/lib/assessment/actions";
import { listManagedKnowledgeChecks } from "@/lib/knowledgeBank/actions";

export const metadata = { title: "Role assessments — Devometrics" };
export const maxDuration = 120;

export default async function CompanyRoleAssessmentsPage() {
  const t = await getTranslations("roleAssessment");
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
          <AssessmentsManager
            roleRows={managed.rows}
            checkRows={"error" in knowledge ? [] : knowledge.rows}
            checksReady={!("error" in knowledge) && knowledge.ready}
            names={managed.names}
            employees={managed.employees}
            roles={managed.roles}
            viewer={managed.viewer}
            settings={managed.settings}
          />
        )}
      </div>
    </div>
  );
}
