import Link from "next/link";
import { redirect } from "next/navigation";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { getKnowledgeHubContentReport } from "@/lib/knowledgeHub/actions";
import AssignKnowledgeHubContentModal from "@/components/dashboard/AssignKnowledgeHubContentModal";
import RemoveKnowledgeHubAssignmentButton from "@/components/dashboard/RemoveKnowledgeHubAssignmentButton";

export default async function KnowledgeHubContentDetailPage({
  params,
}: {
  params: Promise<{ contentId: string }>;
}) {
  const { contentId } = await params;
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
            ← Back to Knowledge Hub
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {content.title}
          </h1>
          {content.description && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{content.description}</p>
          )}
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
            {content.completion_type === "exam"
              ? `Exam — ${content.passing_score_percent}% required to pass`
              : "Completed by confirming they've read it"}
            {" · "}
            {content.file_name}
          </p>
        </div>

        <div style={{ display: "flex", gap: 20, marginBottom: 24, flexWrap: "wrap" }}>
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 20px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{report.assignedCount}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Assigned</div>
          </div>
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 20px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--teal)" }}>{report.completionRate}%</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Completion rate</div>
          </div>
          {content.completion_type === "exam" && (
            <>
              <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 20px" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>
                  {report.averageScorePercent ?? "—"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Average score</div>
              </div>
              <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 20px" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{report.passRate ?? "—"}%</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Pass rate</div>
              </div>
            </>
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <AssignKnowledgeHubContentModal
            contentId={contentId}
            employees={data.rows.map((r) => ({ userId: r.userId, name: r.name, email: r.email }))}
            alreadyAssignedUserIds={report.rows.map((r) => r.employeeUserId)}
          />
        </div>

        {report.rows.length === 0 ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Not assigned to anyone yet.</p>
          </div>
        ) : (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...headStyle, textAlign: "left" }}>Name</th>
                    <th style={{ ...headStyle, textAlign: "left" }}>Status</th>
                    <th style={{ ...headStyle, textAlign: "left" }}>Completed</th>
                    {content.completion_type === "exam" && (
                      <th style={{ ...headStyle, textAlign: "right" }}>Score</th>
                    )}
                    <th style={{ ...headStyle, textAlign: "right" }} aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r) => (
                    <tr key={r.employeeUserId}>
                      <td style={cellStyle}>
                        <div>{r.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.email}</div>
                      </td>
                      <td style={cellStyle}>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: r.status === "completed" ? "var(--teal)" : "var(--text-muted)",
                          }}
                        >
                          {r.status === "completed" ? "Completed" : "Not started"}
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
                      <td style={{ ...cellStyle, textAlign: "right" }}>
                        <RemoveKnowledgeHubAssignmentButton assignmentId={r.assignmentId} contentId={contentId} />
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
