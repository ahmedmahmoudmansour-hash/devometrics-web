import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { KnowledgeHubContent, KnowledgeHubCompletion } from "@/lib/supabase/types";

export default async function KnowledgeHubPage() {
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

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to progress
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            Knowledge Hub
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            Training content your organization has assigned to you.
          </p>
        </div>

        {(assignments ?? []).length === 0 ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
              Nothing assigned to you yet.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(assignments ?? []).map((a) => {
              const content = a.knowledge_hub_content;
              const completion = latestCompletionByContent.get(a.content_id);
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
                        {content.completion_type === "exam" ? "Exam required" : "Read confirmation"}
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        color: completion ? "var(--teal)" : "var(--amber)",
                      }}
                    >
                      {completion
                        ? content.completion_type === "exam"
                          ? `${completion.passed ? "Passed" : "Completed"} — ${completion.score_percent}%`
                          : "Completed"
                        : "Not started"}
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
