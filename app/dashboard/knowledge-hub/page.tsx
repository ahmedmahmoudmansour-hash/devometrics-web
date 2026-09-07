import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import FeatureRestrictedNotice from "@/components/dashboard/FeatureRestrictedNotice";
import { getMyOrganizationId } from "@/lib/organizations/membership";
import { listMyRestrictedFeatures } from "@/lib/organizations/featureAccess";
import type { KnowledgeHubContent, KnowledgeHubCompletion, KnowledgeHubCourse } from "@/lib/supabase/types";

export default async function KnowledgeHubPage() {
  const t = await getTranslations("knowledgeHubPage");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organizationId = await getMyOrganizationId(supabase, user.id);
  const restricted = await listMyRestrictedFeatures(supabase, organizationId);
  if (restricted.has("knowledge_hub")) {
    return (
      <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ marginBottom: 32 }}>
            <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
              {t("backToProgress")}
            </Link>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{t("title")}</h1>
          </div>
          <FeatureRestrictedNotice message={t("restrictedNotice")} />
        </div>
      </div>
    );
  }

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

  // Group by course_id (migration 0151) — a course renders as one card with
  // its ordered modules and a rollup progress bar; everything else renders
  // exactly as before (a flat card per assignment).
  const standaloneAssignments = (assignments ?? []).filter((a) => !a.knowledge_hub_content.course_id);
  const courseAssignments = (assignments ?? []).filter((a) => a.knowledge_hub_content.course_id);
  const courseIds = Array.from(new Set(courseAssignments.map((a) => a.knowledge_hub_content.course_id!)));
  const { data: coursesData } = courseIds.length
    ? await supabase.from("knowledge_hub_courses").select("*").in("id", courseIds).returns<KnowledgeHubCourse[]>()
    : { data: [] };
  const courseById = new Map((coursesData ?? []).map((c) => [c.id, c]));

  const assignmentsByCourse = new Map<string, typeof courseAssignments>();
  for (const a of courseAssignments) {
    const courseId = a.knowledge_hub_content.course_id!;
    const list = assignmentsByCourse.get(courseId) ?? [];
    list.push(a);
    assignmentsByCourse.set(courseId, list);
  }
  for (const list of assignmentsByCourse.values()) {
    list.sort((a, b) => a.knowledge_hub_content.course_position - b.knowledge_hub_content.course_position);
  }

  function moduleCard(a: { id: string; content_id: string; knowledge_hub_content: KnowledgeHubContent }) {
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
              {content.completion_type === "exam"
                ? t("examRequired")
                : content.completion_type === "scorm"
                  ? t("scormCourse")
                  : t("readConfirmation")}
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
              ? completion.score_percent !== null && (content.completion_type === "exam" || content.completion_type === "scorm")
                ? completion.passed
                  ? t("passedScore", { percent: completion.score_percent })
                  : t("completedScore", { percent: completion.score_percent })
                : t("completed")
              : isOverdue
                ? t("overdue")
                : t("notStarted")}
          </span>
        </div>
      </Link>
    );
  }

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
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {Array.from(assignmentsByCourse.entries()).map(([courseId, courseModuleAssignments]) => {
              const course = courseById.get(courseId);
              const completedCount = courseModuleAssignments.filter((a) => latestCompletionByContent.has(a.content_id)).length;
              const totalCount = courseModuleAssignments.length;
              const pct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
              return (
                <div key={courseId} style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>{course?.title ?? t("scormCourse")}</p>
                  {course?.description && <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>{course.description}</p>}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <div style={{ flex: 1, height: 6, borderRadius: 100, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "var(--teal)" }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--teal)", whiteSpace: "nowrap" }}>
                      {t("courseProgress", { completed: completedCount, total: totalCount })}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {courseModuleAssignments.map((a) => moduleCard(a))}
                  </div>
                </div>
              );
            })}

            {standaloneAssignments.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {standaloneAssignments.map((a) => moduleCard(a))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
