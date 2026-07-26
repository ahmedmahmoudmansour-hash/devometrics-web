import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import KnowledgeHubContentViewer from "@/components/dashboard/KnowledgeHubContentViewer";
import type { KnowledgeHubContent, KnowledgeHubCompletion } from "@/lib/supabase/types";

export default async function KnowledgeHubContentPage({
  params,
}: {
  params: Promise<{ contentId: string }>;
}) {
  const { contentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: assignment } = await supabase
    .from("knowledge_hub_assignments")
    .select("id")
    .eq("content_id", contentId)
    .eq("employee_user_id", user.id)
    .maybeSingle<{ id: string }>();
  if (!assignment) redirect("/dashboard/knowledge-hub");

  const { data: content } = await supabase
    .from("knowledge_hub_content")
    .select("*")
    .eq("id", contentId)
    .maybeSingle<KnowledgeHubContent>();
  if (!content) redirect("/dashboard/knowledge-hub");

  const { data: completions } = await supabase
    .from("knowledge_hub_completions")
    .select("*")
    .eq("content_id", contentId)
    .eq("employee_user_id", user.id)
    .order("completed_at", { ascending: false })
    .returns<KnowledgeHubCompletion[]>();
  const latestCompletion = completions?.[0] ?? null;
  const examAttemptCount = (completions ?? []).filter((c) => c.method === "exam").length;

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard/knowledge-hub" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to Knowledge Hub
          </Link>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {content.title}
          </h1>
          {content.description && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{content.description}</p>
          )}
        </div>

        <KnowledgeHubContentViewer
          contentId={contentId}
          fileName={content.file_name}
          mimeType={content.mime_type}
          completionType={content.completion_type}
          passingScorePercent={content.passing_score_percent}
          maxAttempts={content.max_attempts}
          initialExamAttemptCount={examAttemptCount}
          initialLastAttemptAt={latestCompletion?.completed_at ?? null}
          initialCompletion={
            latestCompletion
              ? { scorePercent: latestCompletion.score_percent, passed: latestCompletion.passed }
              : null
          }
        />
      </div>
    </div>
  );
}
