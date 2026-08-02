"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { assignAssessment, removeAssignedAssessment } from "@/lib/organizations/actions";
import { ASSESSMENTS, type AssessmentTranslator } from "@/lib/assessments/catalog";
import { ENGLISH_PROFICIENCY_SLUG } from "@/lib/assessments/englishProficiency";
import { COGNITIVE_ABILITY_SLUG } from "@/lib/assessments/cognitiveAbility";
import { CASE_STUDY_EXERCISES } from "@/lib/assessments/caseStudyExercises";
import { resolveAssignableDisplayName } from "@/lib/assessments/assignableCatalog";

// English Proficiency and Cognitive Reasoning live outside ASSESSMENTS
// (they're objective tests, not the self-report catalog — see
// lib/assessments/englishProficiency.ts and cognitiveAbility.ts), but
// admins should still be able to push them to someone the same way as any
// other assessment, so they're added here rather than to the catalog
// itself (which would wrongly route them through the Likert AssessmentForm).
// Case Study Exercises (lib/assessments/caseStudyExercises.ts) are a
// fourth, separate catalog — same reasoning, added here rather than
// merged into ASSESSMENTS since they're a genuinely different exercise
// format (timed, written, AI-scored) with their own completion table.
function buildAssignable(t: AssessmentTranslator, tExercise: (key: string) => string) {
  return [
    ...ASSESSMENTS.map((a) => ({ slug: a.slug, name: resolveAssignableDisplayName(t, tExercise, a.slug), level: a.level as string })),
    { slug: ENGLISH_PROFICIENCY_SLUG, name: resolveAssignableDisplayName(t, tExercise, ENGLISH_PROFICIENCY_SLUG), level: "A1–C2" },
    { slug: COGNITIVE_ABILITY_SLUG, name: resolveAssignableDisplayName(t, tExercise, COGNITIVE_ABILITY_SLUG), level: "Numerical/Verbal/Logical" },
    ...CASE_STUDY_EXERCISES.map((e) => ({
      slug: e.slug,
      name: resolveAssignableDisplayName(t, tExercise, e.slug),
      level: `${e.level} exercise`,
    })),
  ];
}

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
  const assignable = buildAssignable(tCatalog, tExercise);
  const assignedSlugs = new Set(assigned.map((a) => a.slug));
  const available = assignable.filter((a) => !assignedSlugs.has(a.slug));
  const [slug, setSlug] = useState(available[0]?.slug ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!slug) return;
    setError(null);
    startTransition(async () => {
      const result = await assignAssessment(employeeUserId, slug);
      if (result?.error) setError(result.error);
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

      {error && <p style={{ color: "#f87171", fontSize: 12.5, marginTop: 10 }}>{error}</p>}
    </div>
  );
}
