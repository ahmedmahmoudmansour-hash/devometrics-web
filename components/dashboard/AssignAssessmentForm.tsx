"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { assignAssessment, removeAssignedAssessment } from "@/lib/organizations/actions";
import { buildAssignableCatalog, resolveAssignableDisplayName } from "@/lib/assessments/assignableCatalog";

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
};

export default function AssignAssessmentForm({
  employeeUserId,
  assigned,
}: {
  employeeUserId: string;
  assigned: { slug: string; name: string; assignedAt: string; completed: boolean }[];
}) {
  const t = useTranslations("assignAssessmentForm");
  const tCatalog = useTranslations("assessmentCatalog");
  const tExercise = useTranslations("caseStudyExercises");
  const assignable = buildAssignableCatalog(tCatalog, tExercise);
  const assignedSlugs = new Set(assigned.map((a) => a.slug));
  const available = assignable.filter((a) => !assignedSlugs.has(a.slug));
  const [slug, setSlug] = useState(available[0]?.slug ?? "");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!slug) return;
    setError(null);
    startTransition(async () => {
      const result = await assignAssessment(employeeUserId, slug, dueDate || null);
      if (result?.error) setError(result.error);
      else setDueDate("");
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
        {t("title")}
      </h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
        {t("description")}
      </p>

      {assigned.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {assigned.map((a) => (
            <div key={a.slug} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
              <span style={{ color: "var(--text)" }}>
                {resolveAssignableDisplayName(tCatalog, tExercise, a.slug)}{" "}
                {a.completed ? (
                  <span style={{ color: "var(--teal)", fontSize: 11, fontWeight: 700 }}>{t("completed")}</span>
                ) : (
                  <span style={{ color: "var(--amber)", fontSize: 11, fontWeight: 700 }}>{t("pending")}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => startTransition(() => { void removeAssignedAssessment(employeeUserId, a.slug); })}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}
              >
                {t("remove")}
              </button>
            </div>
          ))}
        </div>
      )}

      {available.length > 0 ? (
        <form onSubmit={handleAssign} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={slug} onChange={(e) => setSlug(e.target.value)} style={{ ...inputStyle, flex: "1 1 220px", cursor: "pointer" }}>
            {available.map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.name} — {a.level}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            title={t("dueDateLabel")}
            style={{ ...inputStyle, flex: "0 1 160px", cursor: "pointer" }}
          />
          <button
            type="submit"
            disabled={isPending}
            style={{
              background: "var(--teal)",
              color: "#0A0F1E",
              border: "none",
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {t("assign")}
          </button>
        </form>
      ) : (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{t("allAssigned")}</p>
      )}

      {error && <p style={{ color: "var(--danger)", fontSize: 12.5, marginTop: 10 }}>{error}</p>}
    </div>
  );
}
