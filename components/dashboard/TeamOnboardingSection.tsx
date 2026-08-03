"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { approveOnboardingStep } from "@/lib/onboarding/actions";
import type { ReportOnboardingSummary } from "@/lib/onboarding/actions";

export default function TeamOnboardingSection({ reports: initialReports }: { reports: ReportOnboardingSummary[] }) {
  const t = useTranslations("teamOnboardingSection");
  const [reports, setReports] = useState(initialReports);
  const [isPending, startTransition] = useTransition();

  function handleApprove(employeeUserId: string, stepId: string) {
    setReports((prev) =>
      prev.map((r) =>
        r.employeeUserId === employeeUserId
          ? { ...r, completedSteps: r.completedSteps + 1, pendingApprovalSteps: r.pendingApprovalSteps.filter((s) => s.id !== stepId) }
          : r
      )
    );
    startTransition(async () => {
      await approveOnboardingStep(stepId);
    });
  }

  if (reports.length === 0) return null;

  return (
    <div style={{ marginBottom: 28 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{t("title")}</p>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>{t("hint")}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        {reports.map((r) => (
          <div key={r.employeeUserId} style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{r.name}</p>
              <span style={{ fontSize: 12, fontWeight: 700, color: r.completedSteps === r.totalSteps ? "var(--teal)" : "var(--text-muted)" }}>
                {t("progress", { done: r.completedSteps, total: r.totalSteps })}
              </span>
            </div>
            {r.pendingApprovalSteps.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {r.pendingApprovalSteps.map((step) => (
                  <div key={step.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 12.5, color: "var(--text)" }}>{step.title}</span>
                    <button
                      type="button"
                      onClick={() => handleApprove(r.employeeUserId, step.id)}
                      disabled={isPending}
                      style={{
                        flexShrink: 0,
                        background: "rgba(0,201,167,0.1)",
                        border: "1px solid rgba(0,201,167,0.3)",
                        borderRadius: 8,
                        padding: "4px 10px",
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "var(--teal)",
                        cursor: "pointer",
                      }}
                    >
                      {t("approve")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
