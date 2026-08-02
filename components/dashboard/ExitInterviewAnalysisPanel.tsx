"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { analyzeExitInterviewThemes } from "@/lib/exitInterviews/ai";
import type { ExitInterviewAnalysis, ExitInterviewAnalysisRecord } from "@/lib/exitInterviews/types";

const card: React.CSSProperties = {
  background: "var(--navy-mid)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: 24,
  marginBottom: 24,
};

function AnalysisView({ analysis, t }: { analysis: ExitInterviewAnalysis; t: ReturnType<typeof useTranslations> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 16 }}>
      <p style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.7 }}>{analysis.summary}</p>

      {analysis.topThemes.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
            {t("topThemesLabel")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {analysis.topThemes.map((theme, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{theme.theme}</span>
                  <span className="mono" style={{ fontSize: 11.5, color: "var(--amber)", fontWeight: 700 }}>
                    {t("mentionedCount", { count: theme.count })}
                  </span>
                </div>
                <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>{theme.example}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            {t("managerRelatedLabel")}
          </p>
          <p style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.6 }}>{analysis.managerRelatedTurnover}</p>
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            {t("departmentTrendsLabel")}
          </p>
          <p style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.6 }}>{analysis.departmentTrends}</p>
        </div>
      </div>

      {analysis.flightRiskIndicators.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
            {t("flightRiskLabel")}
          </p>
          <ul style={{ margin: 0, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            {analysis.flightRiskIndicators.map((f, i) => (
              <li key={i} style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.5 }}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ExitInterviewAnalysisPanel({ initial }: { initial: ExitInterviewAnalysisRecord | null }) {
  const t = useTranslations("exitInterviewsPage");
  const [analysis, setAnalysis] = useState<ExitInterviewAnalysis | null>(initial?.analysis ?? null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(initial?.created_at ?? null);
  const [interviewCount, setInterviewCount] = useState<number | null>(initial?.interview_count ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await analyzeExitInterviewThemes();
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.analysis) {
        setAnalysis(result.analysis);
        setGeneratedAt(new Date().toISOString());
        setInterviewCount(result.interviewCount ?? null);
      }
    });
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{t("analysisTitle")}</h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5, maxWidth: 500 }}>{t("analysisDescription")}</p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={isPending}
          style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1, whiteSpace: "nowrap" }}
        >
          {isPending ? t("analyzing") : t("analyzeButton")}
        </button>
      </div>

      {error && <p style={{ color: "#f87171", fontSize: 12.5, marginTop: 12 }}>{error}</p>}

      {analysis && (
        <>
          {generatedAt && interviewCount !== null && (
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12 }}>
              {t("basedOn", { count: interviewCount, date: new Date(generatedAt).toLocaleDateString() })}
            </p>
          )}
          <AnalysisView analysis={analysis} t={t} />
        </>
      )}
    </div>
  );
}
