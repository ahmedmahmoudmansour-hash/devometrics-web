import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import type { KnowledgeHubContent, KnowledgeHubCompletion } from "@/lib/supabase/types";

export default async function KnowledgeHubPage() {
  const t = await getTranslations("knowledgeHubPage");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: assignments } = await supabase
    .from("knowledge_hub_assignments")
    .select("id, content_id, knowledge_hub_content(*)")
    .eq("employee_user_id", user.id)
    .returns<{ id: string; content_id: string; knowledge_hub_content: KnowledgeHubContent }[]>();

  const contentIds = (assignments ?? []).map((a) => a.content_id);
  const { data: completions } = contentIds.length
    ? await supabase
        .from("knowledge_hub_completions")
        .select("*")
        .eq("employee_user_id", user.id)
        .in("content_id", contentIds)
        .order("completed_at", { ascending: false })
        .returns<KnowledgeHubCompletion[]>()
    : { data: [] };

  const latestCompletionByContent = new Map<string, KnowledgeHubCompletion>();
  for (const c of completions ?? []) {
    if (!latestCompletionByContent.has(c.content_id)) latestCompletionByContent.set(c.content_id, c);
  }

  const today = new Date().toISOString().slice(0, 10);
  // Same rgb-triple pill-badge convention as CertificationsView's
  // STATUS_STYLE (expired/soon/ok) — reused here rather than inventing a
  // separate red/amber/teal language for the same "how urgent is this"
  // concept.
  const STATUS_COLOR = { overdue: "248,113,113", pending: "240,184,64", done: "0,201,167" } as const;

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {t("title")}
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            {t("description")}
          </p>
        </div>

        {(assignments ?? []).length === 0 ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
              {t("nothingAssigned")}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(assignments ?? []).map((a) => {
              const content = a.knowledge_hub_content;
              const completion = latestCompletionByContent.get(a.content_id);
              const isOverdue = !completion && !!content.due_date && content.due_date < today;
              const statusColor = completion ? STATUS_COLOR.done : isOverdue ? STATUS_COLOR.overdue : STATUS_COLOR.pending;
              return (
                <Link
                  key={a.id}
                  href={`/dashboard/knowledge-hub/${a.content_id}`}
                  style={{
                    display: "block",
                    background: "var(--navy-mid)",
                    border: "1px solid var(--border)",
                    borderRadius: 14,
                    padding: 20,
                    textDecoration: "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
                        {content.title}
                      </h3>
                      {content.description && (
                        <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{content.description}</p>
                      )}
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {content.completion_type === "exam" ? t("examRequired") : t("readConfirmation")}
                        {content.due_date && !completion ? t("dueSuffix", { date: content.due_date }) : ""}
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        padding: "4px 10px",
                        borderRadius: 8,
                        background: `rgba(${statusColor},0.12)`,
                        border: `1px solid rgba(${statusColor},0.35)`,
                        color: `rgb(${statusColor})`,
                      }}
                    >
                      {completion
                        ? content.completion_type === "exam"
                          ? completion.passed
                            ? t("passedScore", { percent: completion.score_percent ?? 0 })
                            : t("completedScore", { percent: completion.score_percent ?? 0 })
                          : t("completed")
                        : isOverdue
                          ? t("overdue")
                          : t("notStarted")}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
