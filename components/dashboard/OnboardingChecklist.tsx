"use client";

import { useState } from "react";
import Link from "next/link";

type Step = {
  label: string;
  description: string;
  href: string;
  done: boolean;
};

export default function OnboardingChecklist({ steps }: { steps: Step[] }) {
  const [dismissed, setDismissed] = useState(false);
  const doneCount = steps.filter((s) => s.done).length;

  if (dismissed || doneCount === steps.length) return null;

  const nextStep = steps.find((s) => !s.done);
  const remainingSteps = steps.filter((s) => s !== nextStep);

  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(0,201,167,0.08), rgba(125,211,252,0.05))",
        border: "1px solid rgba(0,201,167,0.25)",
        borderRadius: 16,
        padding: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Get started with Devometrics</h2>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
        >
          Hide this
        </button>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 18 }}>
        Complete these {steps.length} steps to unlock your full AI Career Health Score.
      </p>

      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            width: `${(doneCount / steps.length) * 100}%`,
            height: "100%",
            background: "var(--teal)",
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {nextStep && (
        <Link
          href={nextStep.href}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            background: "var(--teal)",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 16,
            textDecoration: "none",
          }}
        >
          <span>
            <span style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(10,15,30,0.7)" }}>
              Start here
            </span>
            <span style={{ display: "block", fontSize: 16, fontWeight: 800, color: "#0A0F1E", marginTop: 2 }}>
              {nextStep.label}
            </span>
            <span style={{ display: "block", fontSize: 13, color: "rgba(10,15,30,0.75)", marginTop: 4 }}>
              {nextStep.description}
            </span>
          </span>
          <span style={{ fontSize: 22, color: "#0A0F1E", flexShrink: 0 }}>→</span>
        </Link>
      )}

      {remainingSteps.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {remainingSteps.map((s) => {
            const i = steps.indexOf(s);
            return (
              <Link
                key={s.label}
                href={s.href}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "10px 8px",
                  borderRadius: 8,
                  textDecoration: "none",
                  opacity: s.done ? 1 : 0.7,
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    border: s.done ? "none" : "1px solid var(--border)",
                    background: s.done ? "var(--teal)" : "transparent",
                    color: s.done ? "#0A0F1E" : "var(--text-muted)",
                    fontSize: 12,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {s.done ? "✓" : i + 1}
                </span>
                <span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 14,
                      fontWeight: 600,
                      color: s.done ? "var(--text-muted)" : "var(--text)",
                      textDecoration: s.done ? "line-through" : "none",
                    }}
                  >
                    {s.label}
                  </span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {s.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
