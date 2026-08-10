import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { getKnowledgeHubContentReport } from "@/lib/knowledgeHub/actions";
import AssignKnowledgeHubContentModal from "@/components/dashboard/AssignKnowledgeHubContentModal";
import RemoveKnowledgeHubAssignmentButton from "@/components/dashboard/RemoveKnowledgeHubAssignmentButton";
import EditKnowledgeHubContentForm from "@/components/dashboard/EditKnowledgeHubContentForm";
import KnowledgeHubAttemptHistory from "@/components/dashboard/KnowledgeHubAttemptHistory";

export default async function KnowledgeHubContentDetailPage({
  params,
}: {
  params: Promise<{ contentId: string }>;
}) {
  const { contentId } = await params;
  const t = await getTranslations("knowledgeHubContentDetailPage");
  const data = await buildCompanyData();
  if (!data.isOrgAdmin) redirect("/dashboard");

  const report = await getKnowledgeHubContentReport(contentId);
  if (!report.content) redirect("/dashboard/company/knowledge-hub");
  const content = report.content;

  const cellStyle: React.CSSProperties = {
    padding: "10px 14px",
    fontSize: 13,
    borderBottom: "1px solid var(--border)",
    color: "var(--text)",
  };
  const headStyle: React.CSSProperties = {
    ...cellStyle,
    color: "var(--text-muted)",
    fontWeight: 700,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    borderBottom: "1px solid var(--border)",
  };

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard/company/knowledge-hub" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToKnowledgeHub")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {content.title}
          </h1>
          {content.description && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{content.description}</p>
          )}
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
            {content.completion_type === "exam"
              ? t("examSummary", {
                  percent: content.passing_score_percent,
                  attempts: content.max_attempts ? t("attemptsMax", { count: content.max_attempts }) : t("unlimitedAttempts"),
                })
              : t("completedByConfirm")}
            {" · "}
            {content.file_name}
            {content.due_date && (
              <>
                {" · "}{t("dueLabel", { date: content.due_date })}
              </>
            )}
          </p>
          <div style={{ marginTop: 12 }}>
            <EditKnowledgeHubContentForm content={content} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 20, marginBottom: 24, flexWrap: "wrap" }}>
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 20px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{report.assignedCount}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("assigned")}</div>
          </div>
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 20px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--teal)" }}>{report.completionRate}%</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("completionRate")}</div>
          </div>
          {content.completion_type === "exam" && (
            <>
              <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 20px" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>
                  {report.averageScorePercent ?? "—"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("averageScore")}</div>
              </div>
              <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 20px" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{report.passRate ?? "—"}%</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("passRate")}</div>
              </div>
            </>
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <AssignKnowledgeHubContentModal
            contentId={contentId}
            employees={data.rows.map((r) => ({ userId: r.userId, name: r.name, email: r.email }))}
            alreadyAssignedUserIds={report.rows.filter((r) => r.assignmentId).map((r) => r.employeeUserId)}
          />
        </div>

        {report.rows.length === 0 ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{t("notAssignedYet")}</p>
          </div>
        ) : (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...headStyle, textAlign: "left" }}>{t("colName")}</th>
                    <th style={{ ...headStyle, textAlign: "left" }}>{t("colStatus")}</th>
                    <th style={{ ...headStyle, textAlign: "left" }}>{t("colCompleted")}</th>
                    {content.completion_type === "exam" && (
                      <>
                        <th style={{ ...headStyle, textAlign: "right" }}>{t("colScore")}</th>
                        <th style={{ ...headStyle, textAlign: "right" }}>{t("colAttempts")}</th>
                      </>
                    )}
                    <th style={{ ...headStyle, textAlign: "right" }} aria-label={t("actionsAriaLabel")} />
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r) => (
                    <tr key={r.employeeUserId}>
                      <td style={cellStyle}>
                        <div>{r.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.email}</div>
                        {!r.assignmentId && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic", marginTop: 2 }}>{t("noLongerAssigned")}</div>
                        )}
                        {content.completion_type === "exam" && (
                          <KnowledgeHubAttemptHistory contentId={contentId} employeeUserId={r.employeeUserId} attemptCount={r.examAttempts} />
                        )}
                      </td>
                      <td style={cellStyle}>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: r.status === "completed" ? "var(--teal)" : "var(--text-muted)",
                          }}
                        >
                          {r.status === "completed" ? t("completed") : t("notStarted")}
                        </span>
                      </td>
                      <td style={{ ...cellStyle, color: "var(--text-muted)" }}>
                        {r.completedAt ? new Date(r.completedAt).toLocaleDateString() : "—"}
                      </td>
                      {content.completion_type === "exam" && (
                        <td
                          style={{
                            ...cellStyle,
                            textAlign: "right",
                            fontWeight: 700,
                            color: r.passed === false ? "#f87171" : r.passed ? "var(--teal)" : "var(--text)",
                          }}
                        >
                          {r.scorePercent !== null ? `${r.scorePercent}%` : "—"}
                        </td>
                      )}
                      {content.completion_type === "exam" && (
                        <td style={{ ...cellStyle, textAlign: "right" }}>
                          {r.examAttempts > 0 ? r.examAttempts : "—"}
                          {content.max_attempts !== null && r.examAttempts > 0 && ` / ${content.max_attempts}`}
                        </td>
                      )}
                      <td style={{ ...cellStyle, textAlign: "right" }}>
                        {r.assignmentId && <RemoveKnowledgeHubAssignmentButton assignmentId={r.assignmentId} contentId={contentId} />}
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
