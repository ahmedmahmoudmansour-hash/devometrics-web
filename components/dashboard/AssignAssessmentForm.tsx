"use client";

import { useState, useTransition } from "react";
import { assignAssessment, removeAssignedAssessment } from "@/lib/organizations/actions";
import { ASSESSMENTS } from "@/lib/assessments/catalog";
import { ENGLISH_PROFICIENCY_SLUG } from "@/lib/assessments/englishProficiency";
import { COGNITIVE_ABILITY_SLUG } from "@/lib/assessments/cognitiveAbility";

// English Proficiency and Cognitive Reasoning live outside ASSESSMENTS
// (they're objective tests, not the self-report catalog — see
// lib/assessments/englishProficiency.ts and cognitiveAbility.ts), but
// admins should still be able to push them to someone the same way as any
// other assessment, so they're added here rather than to the catalog
// itself (which would wrongly route them through the Likert AssessmentForm).
const ASSIGNABLE = [
  ...ASSESSMENTS.map((a) => ({ slug: a.slug, name: a.name, level: a.level as string })),
  { slug: ENGLISH_PROFICIENCY_SLUG, name: "English Proficiency", level: "A1–C2" },
  { slug: COGNITIVE_ABILITY_SLUG, name: "Cognitive Reasoning", level: "Numerical/Verbal/Logical" },
];

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
  const assignedSlugs = new Set(assigned.map((a) => a.slug));
  const available = ASSIGNABLE.filter((a) => !assignedSlugs.has(a.slug));
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
        Assign an assessment
      </h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
        Shows up as &quot;assigned to you&quot; in their own Assessment Center — completion is read
        directly from their real result, not tracked separately.
      </p>

      {assigned.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {assigned.map((a) => (
            <div key={a.slug} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
              <span style={{ color: "var(--text)" }}>
                {a.name}{" "}
                {a.completed ? (
                  <span style={{ color: "var(--teal)", fontSize: 11, fontWeight: 700 }}>✓ Completed</span>
                ) : (
                  <span style={{ color: "var(--amber)", fontSize: 11, fontWeight: 700 }}>Pending</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => startTransition(() => { void removeAssignedAssessment(employeeUserId, a.slug); })}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}
              >
                Remove
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
            Assign
          </button>
        </form>
      ) : (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>All assessments are already assigned.</p>
      )}

      {error && <p style={{ color: "#f87171", fontSize: 12.5, marginTop: 10 }}>{error}</p>}
    </div>
  );
}
