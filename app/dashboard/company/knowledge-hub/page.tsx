import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { createClient } from "@/lib/supabase/server";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import KnowledgeHubUploadForm from "@/components/dashboard/KnowledgeHubUploadForm";
import FeatureEmailComposer from "@/components/dashboard/FeatureEmailComposer";
import { listFeatureEmailHistory } from "@/lib/organizations/featureEmails";
import type { KnowledgeHubContent } from "@/lib/supabase/types";

export default async function CompanyKnowledgeHubPage() {
  const t = await getTranslations("companyKnowledgeHubPage");
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) redirect("/dashboard");

  const emailHistory = await listFeatureEmailHistory(data.organizationId, "knowledge_hub");
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

  // UX audit follow-up — an admin previously had no way to see the full set
  // of documents flagged is_new_hire_content (migration 0120) except by
  // opening each item one at a time and checking its checkbox. This
  // surfaces the whole "new-hire packet" at a glance.
  const newHireContent = content.filter((c) => c.is_new_hire_content);

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

  // "Assigned" here is the union of currently-assigned and ever-completed
  // employees per content — completions are kept forever even after
  // someone's unassigned (see lib/knowledgeHub/actions.ts's
  // getKnowledgeHubContentReport), so a completion can never outnumber
  // "assigned" the way it would if this only counted current assignments.
  function addToSetMap(map: Map<string, Set<string>>, key: string, value: string) {
    const set = map.get(key) ?? new Set<string>();
    set.add(value);
    map.set(key, set);
  }

  const assignedEmployeesByContent = new Map<string, Set<string>>();
  for (const a of assignments ?? []) addToSetMap(assignedEmployeesByContent, a.content_id, a.employee_user_id);

  const completedEmployeesByContent = new Map<string, Set<string>>();
  for (const c of completions ?? []) {
    addToSetMap(completedEmployeesByContent, c.content_id, c.employee_user_id);
    addToSetMap(assignedEmployeesByContent, c.content_id, c.employee_user_id);
  }

  const assignedCountByContent = new Map<string, number>();
  for (const [contentId, set] of assignedEmployeesByContent) assignedCountByContent.set(contentId, set.size);

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
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {t("title")}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            {t("description")}
          </p>
        </div>

        <CompanyNavTabs active="knowledgeHub" />

        <div style={{ marginBottom: 24 }}>
          <KnowledgeHubUploadForm organizationId={data.organizationId} />
        </div>

        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginBottom: 24 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
            {t("newHirePacketTitle", { count: newHireContent.length })}
          </p>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: newHireContent.length > 0 ? 12 : 0, lineHeight: 1.5 }}>
            {t("newHirePacketHint")}
          </p>
          {newHireContent.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {newHireContent.map((c) => (
                <Link
                  key={c.id}
                  href={`/dashboard/company/knowledge-hub/${c.id}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 13,
                    color: "var(--text)",
                    textDecoration: "none",
                  }}
                >
                  <span>{c.title}</span>
                  <span style={{ color: "var(--text-muted)" }}>{c.completion_type === "exam" ? t("examWithPassPercent", { percent: c.passing_score_percent }) : t("readConfirmation")}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <FeatureEmailComposer
          organizationId={data.organizationId}
          featureKey="knowledge_hub"
          employees={data.rows.map((r) => ({ userId: r.userId, name: r.name, email: r.email, department: r.department }))}
          initialHistory={emailHistory}
        />

        {content.length === 0 ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
              {t("noContentYet")}
            </p>
          </div>
        ) : (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...headStyle, textAlign: "left" }}>{t("colTitle")}</th>
                    <th style={{ ...headStyle, textAlign: "left" }}>{t("colFormat")}</th>
                    <th style={{ ...headStyle, textAlign: "left" }}>{t("colCompletion")}</th>
                    <th style={{ ...headStyle, textAlign: "left" }}>{t("colDue")}</th>
                    <th style={{ ...headStyle, textAlign: "right" }}>{t("colAssigned")}</th>
                    <th style={{ ...headStyle, textAlign: "right" }}>{t("colCompleted")}</th>
                    <th style={{ ...headStyle, textAlign: "right" }}>{t("colCompletionRate")}</th>
                    <th style={{ ...headStyle, textAlign: "right" }} aria-label={t("actionsAriaLabel")} />
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
                          {c.is_new_hire_content && (
                            <span
                              style={{
                                marginInlineStart: 8,
                                fontSize: 10,
                                fontWeight: 800,
                                letterSpacing: "0.04em",
                                textTransform: "uppercase",
                                color: "var(--teal)",
                                background: "rgba(0,201,167,0.1)",
                                border: "1px solid rgba(0,201,167,0.3)",
                                borderRadius: 999,
                                padding: "2px 8px",
                              }}
                            >
                              {t("newHireBadge")}
                            </span>
                          )}
                        </td>
                        <td style={{ ...cellStyle, color: "var(--text-muted)" }}>
                          {c.file_name.split(".").pop()?.toUpperCase()}
                        </td>
                        <td style={{ ...cellStyle, color: "var(--text-muted)" }}>
                          {c.completion_type === "exam" ? t("examWithPassPercent", { percent: c.passing_score_percent }) : t("readConfirmation")}
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
                            {t("manage")}
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
              {t("archivedCount", { count: archivedContent.length })}
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
                  <span>{t("archivedOn", { date: new Date(c.archived_at!).toLocaleDateString() })}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
