import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { listExitInterviews } from "@/lib/exitInterviews/actions";
import { getLatestExitInterviewAnalysis } from "@/lib/exitInterviews/ai";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import ExitInterviewForm from "@/components/dashboard/ExitInterviewForm";
import ExitInterviewAnalysisPanel from "@/components/dashboard/ExitInterviewAnalysisPanel";
import ExitInterviewsTable from "@/components/dashboard/ExitInterviewsTable";
import FeatureEmailComposer from "@/components/dashboard/FeatureEmailComposer";
import { listFeatureEmailHistory } from "@/lib/organizations/featureEmails";

export const metadata = { title: "Exit Interviews — Devometrics" };

export default async function ExitInterviewsPage() {
  const t = await getTranslations("exitInterviewsPage");
  const data = await buildCompanyData();
  if (!data.isOrgAdmin) redirect("/dashboard");

  const [interviews, latestAnalysis] = await Promise.all([listExitInterviews(), getLatestExitInterviewAnalysis()]);

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div className="dashboard-wide-content">
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{t("title")}</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>{t("description")}</p>
        </div>

        <CompanyNavTabs active="exitInterviews" />

        {data.organizationId && (
          <FeatureEmailComposer
            organizationId={data.organizationId}
            featureKey="exit_interviews"
            employees={data.rows.map((r) => ({ userId: r.userId, name: r.name, email: r.email, department: r.department }))}
            initialHistory={await listFeatureEmailHistory(data.organizationId, "exit_interviews")}
          />
        )}

        <ExitInterviewForm />

        <ExitInterviewAnalysisPanel initial={latestAnalysis} />

        {interviews.length === 0 ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, textAlign: "center" }}>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{t("noInterviewsYet")}</p>
          </div>
        ) : (
          <ExitInterviewsTable interviews={interviews} />
        )}
      </div>
    </div>
  );
}
