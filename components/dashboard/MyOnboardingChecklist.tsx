"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ListChecks, Library, UserCheck, Check } from "lucide-react";
import { completeMyOnboardingStep } from "@/lib/onboarding/actions";
import type { OnboardingInstanceStep, OnboardingStepType } from "@/lib/onboarding/types";

const STEP_ICON: Record<OnboardingStepType, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  task: ListChecks,
  knowledge_hub: Library,
  manager_approval: UserCheck,
};

export default function MyOnboardingChecklist({ steps: initialSteps }: { steps: OnboardingInstanceStep[] }) {
  const t = useTranslations("myOnboardingChecklist");
  const [steps, setSteps] = useState(initialSteps);
  const [isPending, startTransition] = useTransition();

  const completed = steps.filter((s) => s.completed_at).length;

  function handleComplete(stepId: string) {
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, completed_at: new Date().toISOString() } : s)));
    startTransition(async () => {
      await completeMyOnboardingStep(stepId);
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{t("title")}</h2>
        <span style={{ fontSize: 13, fontWeight: 700, color: completed === steps.length ? "var(--teal)" : "var(--text-muted)" }}>
          {t("progress", { done: completed, total: steps.length })}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.map((step) => {
          const Icon = STEP_ICON[step.step_type];
          const done = !!step.completed_at;
          return (
            <div
              key={step.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "12px 14px",
                opacity: done ? 0.6 : 1,
              }}
            >
              <Icon size={15} style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", textDecoration: done ? "line-through" : "none" }}>{step.title}</p>
                {step.description && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.5 }}>{step.description}</p>}
                {step.due_date && !done && <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>{t("dueDate", { date: step.due_date })}</p>}
              </div>

              {done ? (
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--teal)", flexShrink: 0 }}>
                  <Check size={14} /> {t("done")}
                </span>
              ) : step.step_type === "task" ? (
                <button
                  type="button"
                  onClick={() => handleComplete(step.id)}
                  disabled={isPending}
                  style={{
                    flexShrink: 0,
                    background: "rgba(0,201,167,0.1)",
                    border: "1px solid rgba(0,201,167,0.3)",
                    borderRadius: 8,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--teal)",
                    cursor: "pointer",
                  }}
                >
                  {t("markDone")}
                </button>
              ) : step.step_type === "knowledge_hub" ? (
                <Link
                  href="/dashboard/knowledge-hub"
                  style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: "var(--teal)", textDecoration: "none" }}
                >
                  {t("openDocument")} →
                </Link>
              ) : (
                <span style={{ flexShrink: 0, fontSize: 11.5, color: "var(--text-muted)", fontStyle: "italic" }}>{t("awaitingApproval")}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
