"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createKnowledgeHubCourse,
  reorderKnowledgeHubCourseModule,
  archiveKnowledgeHubCourse,
  unarchiveKnowledgeHubCourse,
  deleteKnowledgeHubCourse,
} from "@/lib/knowledgeHub/actions";
import AssignKnowledgeHubContentModal from "./AssignKnowledgeHubContentModal";

export type CourseModuleRow = {
  id: string;
  title: string;
  formatLabel: string; // "SCORM" or a file extension, matching the flat table's existing column
  completionLabel: string; // pre-translated, matching the flat table's existing column
  assignedCount: number;
  completedCount: number;
};

export type CourseRow = {
  id: string;
  title: string;
  description: string | null;
  archivedAt: string | null;
  assignedUserIds: string[]; // union across every module in this course — feeds the assign modal's "already assigned" diff
};

type Employee = { userId: string; name: string; email: string };

function CourseCard({ course, modules, employees }: { course: CourseRow; modules: CourseModuleRow[]; employees: Employee[] }) {
  const t = useTranslations("knowledgeHubCourses");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function reorder(contentId: string, direction: "up" | "down") {
    setError(null);
    startTransition(async () => {
      const result = await reorderKnowledgeHubCourseModule(contentId, direction);
      if ("error" in result) setError(result.error);
      else router.refresh();
    });
  }

  function toggleArchive() {
    setError(null);
    startTransition(async () => {
      const result = course.archivedAt ? await unarchiveKnowledgeHubCourse(course.id) : await archiveKnowledgeHubCourse(course.id);
      if ("error" in result) setError(result.error);
      else router.refresh();
    });
  }

  function handleDelete() {
    if (modules.length > 0) return;
    if (!window.confirm(t("confirmDeleteCourse"))) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteKnowledgeHubCourse(course.id);
      if ("error" in result) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 4 }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{course.title}</p>
          {course.description && <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{course.description}</p>}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={toggleArchive}
            disabled={isPending}
            style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}
          >
            {course.archivedAt ? t("restoreCourse") : t("archiveCourse")}
          </button>
          {modules.length === 0 && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "var(--danger)", cursor: "pointer" }}
            >
              {t("deleteCourse")}
            </button>
          )}
        </div>
      </div>

      <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {t("moduleCount", { count: modules.length })}
      </p>

      {modules.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("noModulesYet")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {modules.map((m, i) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "rgba(255,255,255,0.03)",
                borderRadius: 8,
                padding: "8px 12px",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <button
                  type="button"
                  onClick={() => reorder(m.id, "up")}
                  disabled={isPending || i === 0}
                  aria-label={t("moveUp")}
                  style={{ background: "none", border: "none", color: i === 0 ? "var(--border)" : "var(--text-muted)", cursor: i === 0 ? "default" : "pointer", fontSize: 11, lineHeight: 1, padding: 0 }}
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => reorder(m.id, "down")}
                  disabled={isPending || i === modules.length - 1}
                  aria-label={t("moveDown")}
                  style={{ background: "none", border: "none", color: i === modules.length - 1 ? "var(--border)" : "var(--text-muted)", cursor: i === modules.length - 1 ? "default" : "pointer", fontSize: 11, lineHeight: 1, padding: 0 }}
                >
                  ▼
                </button>
              </div>
              <span style={{ fontSize: 11, color: "var(--text-muted)", width: 18 }}>{i + 1}.</span>
              <Link href={`/dashboard/company/knowledge-hub/${m.id}`} style={{ flex: 1, fontSize: 13, color: "var(--text)", textDecoration: "underline", textDecorationColor: "var(--border)" }}>
                {m.title}
              </Link>
              <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{m.formatLabel}</span>
              <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{m.completionLabel}</span>
              <span style={{ fontSize: 12, color: "var(--teal)", fontWeight: 700, width: 90, textAlign: "right" }}>
                {t("assignedCompleted", { assigned: m.assignedCount, completed: m.completedCount })}
              </span>
            </div>
          ))}
        </div>
      )}

      {modules.length > 0 && (
        <AssignKnowledgeHubContentModal target={{ kind: "course", courseId: course.id }} employees={employees} alreadyAssignedUserIds={course.assignedUserIds} />
      )}

      {error && <p style={{ color: "var(--danger)", fontSize: 12.5, marginTop: 10 }}>{error}</p>}
    </div>
  );
}

export default function KnowledgeHubCourseManager({
  courses,
  modulesByCourse,
  employees,
}: {
  courses: CourseRow[];
  modulesByCourse: Record<string, CourseModuleRow[]>;
  employees: Employee[];
}) {
  const t = useTranslations("knowledgeHubCourses");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const activeCourses = courses.filter((c) => !c.archivedAt);
  const archivedCourses = courses.filter((c) => c.archivedAt);

  function handleCreate() {
    if (!title.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createKnowledgeHubCourse(title, description);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setTitle("");
      setDescription("");
      setCreating(false);
      router.refresh();
    });
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {t("coursesHeading")}
        </p>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            style={{ background: "none", border: "1px solid var(--teal)", color: "var(--teal)", borderRadius: 8, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
          >
            {t("newCourse")}
          </button>
        )}
      </div>

      {creating && (
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <input
            type="text"
            placeholder={t("courseTitlePlaceholder")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 14px", fontSize: 14, color: "var(--text)", marginBottom: 10 }}
          />
          <textarea
            placeholder={t("courseDescriptionPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 14px", fontSize: 14, color: "var(--text)", marginBottom: 10, resize: "vertical" }}
          />
          {error && <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{error}</p>}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!title.trim() || isPending}
              style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: !title.trim() || isPending ? 0.6 : 1 }}
            >
              {isPending ? t("creating") : t("createCourse")}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setError(null);
              }}
              style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      {activeCourses.map((c) => (
        <CourseCard key={c.id} course={c} modules={modulesByCourse[c.id] ?? []} employees={employees} />
      ))}

      {archivedCourses.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
            {t("archivedCoursesCount", { count: archivedCourses.length })}
          </p>
          {archivedCourses.map((c) => (
            <CourseCard key={c.id} course={c} modules={modulesByCourse[c.id] ?? []} employees={employees} />
          ))}
        </div>
      )}
    </div>
  );
}
