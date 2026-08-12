"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { computeFlightRiskScore } from "@/lib/retention/ai";
import type { FlightRiskScore } from "@/lib/retention/types";
import { levelText } from "@/lib/ui/levelColor";

const card: React.CSSProperties = {
  background: "var(--navy-mid)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: 24,
  marginBottom: 24,
};

const confidenceColor: Record<string, string> = {
  high: "var(--teal)",
  medium: "var(--amber)",
  low: "var(--text-muted)",
};

export default function FlightRiskPanel({ employeeUserId, initial }: { employeeUserId: string; initial: FlightRiskScore | null }) {
  const t = useTranslations("flightRiskPanel");
  const [result, setResult] = useState<FlightRiskScore | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const response = await computeFlightRiskScore(employeeUserId);
      if (response.error) {
        setError(response.error);
        return;
      }
      if (response.result) setResult(response.result);
    });
  }

  return (
    <div className="print-avoid-break" style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{t("title")}</h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5, maxWidth: 480 }}>{t("description")}</p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={isPending}
          style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1, whiteSpace: "nowrap" }}
        >
          {isPending ? t("computing") : result ? t("recomputeButton") : t("computeButton")}
        </button>
      </div>

      {error && <p style={{ color: "var(--danger)", fontSize: 12.5, marginTop: 12 }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 20, flexWrap: "wrap" }}>
            <div>
              <span className="mono" style={{ fontSize: 32, fontWeight: 800, color: levelText(100 - result.score) }}>
                {result.score}
              </span>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>/100</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: confidenceColor[result.confidence] }}>
              {t("confidenceLabel", { level: t(`confidence${result.confidence.charAt(0).toUpperCase()}${result.confidence.slice(1)}`) })}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {t("generatedOn", { date: new Date(result.created_at).toLocaleDateString() })}
            </span>
          </div>

          {result.contributing_factors.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                {t("contributingFactorsLabel")}
              </p>
              <ul style={{ margin: 0, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                {result.contributing_factors.map((f, i) => (
                  <li key={i} style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {result.suggested_actions.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                {t("suggestedActionsLabel")}
              </p>
              <ul style={{ margin: 0, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                {result.suggested_actions.map((a, i) => (
                  <li key={i} style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
