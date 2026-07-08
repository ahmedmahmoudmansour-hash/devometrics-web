"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { generatePlanFromAssessments } from "@/app/dashboard/assessments/planActions";
import { updateLearningPreferences } from "@/app/dashboard/actions";
import { LEARNING_FORMATS, LEARNING_FORMAT_DESCRIPTIONS } from "@/lib/gap-analysis/actionLibrary";
import { HORIZONS, type Horizon } from "@/lib/gap-analysis/horizons";

export default function AssessmentPlanGenerator({
  completedCount,
  learningPreferences,
}: {
  completedCount: number;
  learningPreferences: string[];
}) {
  const [horizon, setHorizon] = useState<Horizon>("90-day");
  const [selectedFormats, setSelectedFormats] = useState<string[]>(learningPreferences);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success?: boolean; planId?: string; error?: string } | null>(null);

  if (completedCount === 0) return null;

  function toggleFormat(format: string) {
    setSelectedFormats((prev) => (prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format]));
  }

  return (
    <div
      style={{
        background: "var(--navy-mid)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 24,
        marginBottom: 32,
      }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
        Turn these results into a Personal Development Plan
      </h2>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>
        Ranks your weakest completed assessments and builds a paced plan from them —
        the same personalization engine behind the Gap Analysis plan, driven by your
        Assessment Center scores instead.
      </p>

      {result?.success ? (
        <p style={{ fontSize: 14, color: "var(--teal)", fontWeight: 600 }}>
          Plan created —{" "}
          <Link href={`/dashboard/plans/${result.planId}`} style={{ color: "var(--teal)" }}>
            view it on your dashboard
          </Link>
          .
        </p>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 8 }}>
              How do you want to learn?
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {LEARNING_FORMATS.map((format) => {
                const checked = selectedFormats.includes(format);
                return (
                  <button
                    key={format}
                    type="button"
                    onClick={() => toggleFormat(format)}
                    title={LEARNING_FORMAT_DESCRIPTIONS[format]}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 100,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: checked ? "1px solid rgba(0,201,167,0.4)" : "1px solid var(--border)",
                      background: checked ? "rgba(0,201,167,0.12)" : "rgba(255,255,255,0.05)",
                      color: checked ? "var(--teal)" : "var(--text-muted)",
                    }}
                  >
                    {format}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {HORIZONS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHorizon(h)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 100,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: horizon === h ? "1px solid var(--teal)" : "1px solid var(--border)",
                  background: horizon === h ? "rgba(0,201,167,0.1)" : "transparent",
                  color: horizon === h ? "var(--teal)" : "var(--text-muted)",
                }}
              >
                {h}
              </button>
            ))}
          </div>
          {result?.error && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{result.error}</p>}
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const prefResult = await updateLearningPreferences(selectedFormats);
                const r = await generatePlanFromAssessments(horizon);
                if (r.planId) {
                  setResult(r);
                } else if (prefResult?.error) {
                  setResult({ error: `Couldn't save your learning preference (${prefResult.error}) — generating with your last saved preference instead.` });
                } else {
                  setResult(r);
                }
              })
            }
            style={{
              background: "var(--teal)",
              color: "#0A0F1E",
              border: "none",
              borderRadius: 8,
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? "Creating plan…" : "Generate my PDP"}
          </button>
        </>
      )}
    </div>
  );
}
