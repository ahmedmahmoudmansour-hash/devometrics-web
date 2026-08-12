"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle2, Lock, Circle } from "lucide-react";

export type SetupGuideStep = {
  key: string;
  href: string;
  done: boolean;
};

// Sequential gating computed here (not passed in) — a step is locked only
// by the step immediately before it, but since a not-done step never flips
// to done retroactively, that single check cascades correctly through the
// rest of the list without needing to look further back.
function withLocks(steps: SetupGuideStep[]): (SetupGuideStep & { locked: boolean })[] {
  let unlockedSoFar = true;
  return steps.map((s) => {
    const locked = !unlockedSoFar;
    if (!s.done) unlockedSoFar = false;
    return { ...s, locked };
  });
}

// Rendered at the top of Company Profile for a brand-new admin — 5 steps,
// opened in sequence so someone setting up a company for the first time
// isn't shown 15 nav tabs with no sense of what to do first. Steps are
// server-computed from real data (see app/dashboard/company/page.tsx)
// rather than a persisted "onboarding progress" row — there's nothing to
// get out of sync, and re-visiting this page always reflects reality.
export default function CompanySetupGuide({ steps }: { steps: SetupGuideStep[] }) {
  const t = useTranslations("companySetupGuide");
  const withLockState = withLocks(steps);
  const allDone = steps.every((s) => s.done);
  const [expanded, setExpanded] = useState(!allDone);

  if (allDone && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          textAlign: "left",
          background: "var(--navy-mid)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: "14px 20px",
          marginBottom: 24,
          cursor: "pointer",
        }}
      >
        <CheckCircle2 size={18} color="var(--teal)" />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{t("completeBanner")}</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>{t("reviewAgain")}</span>
      </button>
    );
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 22, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{t("title")}</p>
        {allDone && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", padding: 0 }}
          >
            {t("collapse")}
          </button>
        )}
      </div>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 18, lineHeight: 1.6, maxWidth: 640 }}>{t("guidelines")}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {withLockState.map((step) => {
          const content = (
            <>
              <span style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 22 }}>
                {step.done ? (
                  <CheckCircle2 size={18} color="var(--teal)" />
                ) : step.locked ? (
                  <Lock size={15} color="var(--text-muted)" />
                ) : (
                  <Circle size={16} color="var(--text-muted)" />
                )}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: step.locked ? "var(--text-muted)" : "var(--text)",
                    display: "block",
                  }}
                >
                  {t(`step_${step.key}_label`)}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                  {step.locked ? t("lockedHint") : t(`step_${step.key}_description`)}
                </span>
              </span>
            </>
          );
          const rowStyle: React.CSSProperties = {
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "10px 8px",
            borderRadius: 10,
            textDecoration: "none",
          };
          return step.locked || step.done ? (
            <div key={step.key} style={rowStyle}>
              {content}
            </div>
          ) : (
            <Link key={step.key} href={step.href} style={{ ...rowStyle, cursor: "pointer" }}>
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
