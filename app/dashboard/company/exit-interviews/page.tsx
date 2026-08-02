import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { listExitInterviews } from "@/lib/exitInterviews/actions";
import { getLatestExitInterviewAnalysis } from "@/lib/exitInterviews/ai";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import ExitInterviewForm from "@/components/dashboard/ExitInterviewForm";
import ExitInterviewAnalysisPanel from "@/components/dashboard/ExitInterviewAnalysisPanel";
import DeleteExitInterviewButton from "@/components/dashboard/DeleteExitInterviewButton";

export const metadata = { title: "Exit Interviews — Devometrics" };

const cellStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 13,
  borderBottom: "1px solid var(--border)",
  color: "var(--text)",
  verticalAlign: "top",
};
const headStyle: React.CSSProperties = {
  ...cellStyle,
  color: "var(--text-muted)",
  fontWeight: 700,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

export default async function ExitInterviewsPage() {
  const t = await getTranslations("exitInterviewsPage");
  const data = await buildCompanyData();
  if (!data.isOrgAdmin) redirect("/dashboard");

  const [interviews, latestAnalysis] = await Promise.all([listExitInterviews(), getLatestExitInterviewAnalysis()]);

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{t("title")}</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>{t("description")}</p>
        </div>

        <CompanyNavTabs active="exitInterviews" />

        <ExitInterviewForm />

        <ExitInterviewAnalysisPanel initial={latestAnalysis} />

        {interviews.length === 0 ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, textAlign: "center" }}>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{t("noInterviewsYet")}</p>
          </div>
        ) : (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...headStyle, textAlign: "left" }}>{t("colName")}</th>
                    <th style={{ ...headStyle, textAlign: "left" }}>{t("colDepartment")}</th>
                    <th style={{ ...headStyle, textAlign: "left" }}>{t("colSeparationType")}</th>
                    <th style={{ ...headStyle, textAlign: "left", whiteSpace: "nowrap" }}>{t("colLastDay")}</th>
                    <th style={{ ...headStyle, textAlign: "left" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {interviews.map((iv) => (
                    <tr key={iv.id}>
                      <td style={cellStyle}>{iv.employee_name}</td>
                      <td style={{ ...cellStyle, color: iv.department ? "var(--text)" : "var(--text-muted)" }}>{iv.department ?? "—"}</td>
                      <td style={cellStyle}>{t(`separation${iv.separation_type.charAt(0).toUpperCase()}${iv.separation_type.slice(1)}`)}</td>
                      <td style={{ ...cellStyle, whiteSpace: "nowrap", color: "var(--text-muted)" }}>
                        {iv.last_day ? new Date(iv.last_day).toLocaleDateString() : "—"}
                      </td>
                      <td style={cellStyle}>
                        <DeleteExitInterviewButton id={iv.id} label={t("deleteButton")} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
