import Link from "next/link";
import { redirect } from "next/navigation";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { createClient } from "@/lib/supabase/server";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import KnowledgeHubUploadForm from "@/components/dashboard/KnowledgeHubUploadForm";
import type { KnowledgeHubContent } from "@/lib/supabase/types";

export default async function CompanyKnowledgeHubPage() {
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) redirect("/dashboard");

  const supabase = await createClient();
  const { data: allContent } = await supabase
    .from("knowledge_hub_content")
    .select("*")
    .eq("organization_id", data.organizationId)
    .order("created_at", { ascending: false })
    .returns<KnowledgeHubContent[]>();

  // Archived content is hidden from the active list but its row (and
  // completion history) is never deleted — see migration 0085.
  const content = (allContent ?? []).filter((c) => !c.archived_at);
  const archivedContent = (allContent ?? []).filter((c) => c.archived_at);

  const contentIds = content.map((c) => c.id);
  const [{ data: assignments }, { data: completions }] = contentIds.length
    ? await Promise.all([
        supabase
          .from("knowledge_hub_assignments")
          .select("content_id, employee_user_id")
          .in("content_id", contentIds)
          .returns<{ content_id: string; employee_user_id: string }[]>(),
        supabase
          .from("knowledge_hub_completions")
          .select("content_id, employee_user_id")
          .in("content_id", contentIds)
          .returns<{ content_id: string; employee_user_id: string }[]>(),
      ])
    : [{ data: [] }, { data: [] }];

  const assignedCountByContent = new Map<string, number>();
  for (const a of assignments ?? []) {
    assignedCountByContent.set(a.content_id, (assignedCountByContent.get(a.content_id) ?? 0) + 1);
  }
  const completedEmployeesByContent = new Map<string, Set<string>>();
  for (const c of completions ?? []) {
    const set = completedEmployeesByContent.get(c.content_id) ?? new Set<string>();
    set.add(c.employee_user_id);
    completedEmployeesByContent.set(c.content_id, set);
  }

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
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to progress
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            Knowledge Hub
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Upload training documents, assign them to your team, and track who&apos;s completed them.
          </p>
        </div>

        <CompanyNavTabs active="knowledgeHub" />

        <div style={{ marginBottom: 24 }}>
          <KnowledgeHubUploadForm organizationId={data.organizationId} />
        </div>

        {content.length === 0 ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
              No content uploaded yet. Use the form above to add your first document.
            </p>
          </div>
        ) : (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...headStyle, textAlign: "left" }}>Title</th>
                    <th style={{ ...headStyle, textAlign: "left" }}>Format</th>
                    <th style={{ ...headStyle, textAlign: "left" }}>Completion</th>
                    <th style={{ ...headStyle, textAlign: "left" }}>Due</th>
                    <th style={{ ...headStyle, textAlign: "right" }}>Assigned</th>
                    <th style={{ ...headStyle, textAlign: "right" }}>Completed</th>
                    <th style={{ ...headStyle, textAlign: "right" }}>Completion rate</th>
                    <th style={{ ...headStyle, textAlign: "right" }} aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {content.map((c) => {
                    const assigned = assignedCountByContent.get(c.id) ?? 0;
                    const completed = completedEmployeesByContent.get(c.id)?.size ?? 0;
                    const rate = assigned ? Math.round((completed / assigned) * 100) : 0;
                    return (
                      <tr key={c.id}>
                        <td style={cellStyle}>
                          <Link
                            href={`/dashboard/company/knowledge-hub/${c.id}`}
                            style={{ color: "var(--text)", textDecoration: "underline", textDecorationColor: "var(--border)" }}
                          >
                            {c.title}
                          </Link>
                        </td>
                        <td style={{ ...cellStyle, color: "var(--text-muted)" }}>
                          {c.file_name.split(".").pop()?.toUpperCase()}
                        </td>
                        <td style={{ ...cellStyle, color: "var(--text-muted)" }}>
                          {c.completion_type === "exam" ? `Exam (${c.passing_score_percent}% to pass)` : "Read confirmation"}
                        </td>
                        <td style={{ ...cellStyle, color: "var(--text-muted)" }}>{c.due_date ?? "—"}</td>
                        <td style={{ ...cellStyle, textAlign: "right" }}>{assigned}</td>
                        <td style={{ ...cellStyle, textAlign: "right" }}>{completed}</td>
                        <td style={{ ...cellStyle, textAlign: "right", color: "var(--teal)", fontWeight: 700 }}>
                          {assigned ? `${rate}%` : "—"}
                        </td>
                        <td style={{ ...cellStyle, textAlign: "right" }}>
                          <Link
                            href={`/dashboard/company/knowledge-hub/${c.id}`}
                            style={{ fontSize: 12, fontWeight: 700, color: "var(--teal)", textDecoration: "none" }}
                          >
                            Manage →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {archivedContent.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
              Archived ({archivedContent.length})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {archivedContent.map((c) => (
                <Link
                  key={c.id}
                  href={`/dashboard/company/knowledge-hub/${c.id}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    background: "var(--navy-mid)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: "var(--text-muted)",
                    textDecoration: "none",
                  }}
                >
                  <span>{c.title}</span>
                  <span>Archived {new Date(c.archived_at!).toLocaleDateString()}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
