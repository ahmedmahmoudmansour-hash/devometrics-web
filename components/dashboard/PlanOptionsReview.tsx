"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  getPlanOptions,
  generatePlanFromSelections,
} from "@/app/dashboard/gap-analysis/actions";
import type { LearningFormat } from "@/lib/gap-analysis/actionLibrary";
import { dimensionLabel, type CompetencyDimension } from "@/lib/gap-analysis/dimensions";
import type { Horizon } from "@/lib/gap-analysis/horizons";

type GapOptions = {
  dimension: string;
  currentLevel: number;
  targetLevel: number;
  impact: number;
  options: { format: LearningFormat; title: string; description: string }[];
};

export default function PlanOptionsReview({
  analysisId,
  targetRole,
  horizon,
  defaultFormat,
  onDone,
}: {
  analysisId: string;
  targetRole: string;
  horizon: Horizon;
  defaultFormat: LearningFormat | null;
  onDone: (planId: string) => void;
}) {
  const t = useTranslations("planOptionsReview");
  const tDim = useTranslations("competencyDimensions");
  const [gaps, setGaps] = useState<GapOptions[] | null>(null);
  const [selections, setSelections] = useState<Record<string, LearningFormat>>({});
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  if (gaps === null && loading) {
    getPlanOptions(analysisId, horizon).then((result) => {
      const rows = (result ?? []) as GapOptions[];
      setGaps(rows);
      const initial: Record<string, LearningFormat> = {};
      for (const g of rows) {
        initial[g.dimension] = defaultFormat ?? g.options[0].format;
      }
      setSelections(initial);
      setLoading(false);
    });
    return (
      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{t("loadingOptions")}</p>
      </div>
    );
  }

  if (!gaps) return null;

  function submit() {
    const payload = gaps!.map((g) => ({
      dimension: g.dimension as CompetencyDimension,
      currentLevel: g.currentLevel,
      targetLevel: g.targetLevel,
      format: selections[g.dimension],
    }));
    startTransition(() => {
      generatePlanFromSelections(analysisId, targetRole, horizon, payload).then((result) => {
        if (result?.planId) onDone(result.planId);
      });
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
          {t("chooseTitle")}
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
          {t("chooseSubtitle")}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {gaps.map((g) => (
            <div key={g.dimension}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{dimensionLabel(tDim, g.dimension as CompetencyDimension)}</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {g.currentLevel} → {g.targetLevel} · <span style={{ color: "var(--teal)" }}>{t("impactLabel", { value: g.impact })}</span>
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                {g.options.map((opt) => {
                  const selected = selections[g.dimension] === opt.format;
                  return (
                    <button
                      key={opt.format}
                      type="button"
                      onClick={() => setSelections((prev) => ({ ...prev, [g.dimension]: opt.format }))}
                      style={{
                        textAlign: "start",
                        padding: 14,
                        borderRadius: 10,
                        cursor: "pointer",
                        border: selected ? "1px solid var(--teal)" : "1px solid rgba(255,255,255,0.1)",
                        background: selected ? "rgba(var(--teal-rgb),0.1)" : "rgba(255,255,255,0.04)",
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: selected ? "var(--teal)" : "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {opt.format}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginTop: 6 }}>
                        {opt.title}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={submit}
          style={{
            marginTop: 28,
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
          {isPending ? t("creatingPlan") : t("createMyPlan")}
        </button>
      </div>
    </div>
  );
}
