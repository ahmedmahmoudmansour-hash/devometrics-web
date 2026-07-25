"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { generateQuickPlan } from "@/app/dashboard/gap-analysis/actions";
import { updateProfile } from "@/app/dashboard/actions";
import PersonalizationFields, { type PersonalizationValues } from "@/components/dashboard/PersonalizationFields";
import { HORIZONS, type Horizon } from "@/lib/gap-analysis/horizons";

export default function AssessmentPlanGenerator({
  completedCount,
  personalization,
  defaultTargetRole,
}: {
  completedCount: number;
  personalization: PersonalizationValues;
  defaultTargetRole: string;
}) {
  const [targetRole, setTargetRole] = useState(defaultTargetRole);
  const [horizon, setHorizon] = useState<Horizon>("90-day");
  const [values, setValues] = useState<PersonalizationValues>(personalization);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success?: boolean; planId?: string; error?: string } | null>(null);

  if (completedCount === 0) return null;

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
        Builds a paced plan from everything known about you — your completed
        assessments, CV, Career Profile, and Big Five — the same engine behind
        every plan on Devometrics, just triggered from here.
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
              Target role
            </label>
            <input
              type="text"
              required
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              aria-label="Target role"
              placeholder="e.g. Senior Product Manager"
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 14,
                color: "var(--text)",
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <PersonalizationFields value={values} onChange={setValues} showCareerStage={false} />
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
                if (!targetRole.trim()) {
                  setResult({ error: "Target role is required." });
                  return;
                }
                await updateProfile(
                  values.location,
                  values.learningPreferences,
                  values.careerStage,
                  values.accommodation,
                  values.resourceTier
                );
                setResult(await generateQuickPlan(targetRole, "", horizon));
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
