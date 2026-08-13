"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import FileUploadButton from "@/components/FileUploadButton";
import type { ResumeAnalysis } from "@/lib/supabase/types";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
  fontFamily: "inherit",
};

function ScoreRing({ label, score }: { label: string; score: number }) {
  const color = score >= 70 ? "var(--teal)" : score >= 40 ? "var(--amber)" : "var(--danger)";
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 32, fontWeight: 800, color }}>{score}</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Chip({ text, tone }: { text: string; tone: "match" | "missing" }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 12,
        padding: "4px 10px",
        borderRadius: 100,
        marginInlineEnd: 6,
        marginBlockEnd: 6,
        background: tone === "match" ? "rgba(var(--teal-rgb),0.1)" : "rgba(var(--danger-rgb),0.1)",
        color: tone === "match" ? "var(--teal)" : "var(--danger)",
        border: `1px solid ${tone === "match" ? "rgba(var(--teal-rgb),0.3)" : "rgba(var(--danger-rgb),0.3)"}`,
      }}
    >
      {text}
    </span>
  );
}

export default function ResumeIntelligenceFlow({ latest }: { latest: ResumeAnalysis | null }) {
  const t = useTranslations("resumeIntelligenceFlow");
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(latest);
  const [showForm, setShowForm] = useState(!latest);
  const [targetRole, setTargetRole] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/resume-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, targetRole, consent }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || t("errorFallback"));
      }
      const { analysis } = await res.json();
      setAnalysis(analysis);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorFallback"));
    } finally {
      setLoading(false);
    }
  }

  if (showForm || !analysis) {
    return (
      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
          {t("formTitle")}
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
          {t("formSubtitle")}
        </p>
        <form onSubmit={runAnalysis} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input
            type="text"
            aria-label={t("targetRoleAria")}
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder={t("targetRolePlaceholder")}
            style={inputStyle}
          />
          <div>
            <textarea
              required
              aria-label={t("resumeTextAria")}
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder={t("resumeTextPlaceholder")}
              rows={10}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <div style={{ marginTop: 6 }}>
              <FileUploadButton onExtracted={(text) => setResumeText(text)} label={t("uploadLabel")} />
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--text-muted)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              style={{ marginTop: 2, accentColor: "var(--teal)" }}
            />
            <span>
              {t("consentLabel")}{" "}
              <Link href="/privacy" target="_blank" style={{ color: "var(--teal)" }}>
                {t("privacyLinkText")}
              </Link>
            </span>
          </label>
          {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
          <button
            type="submit"
            disabled={loading || !consent}
            style={{
              alignSelf: "flex-start",
              background: "var(--teal)",
              color: "#0A0F1E",
              border: "none",
              borderRadius: 8,
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 700,
              cursor: consent ? "pointer" : "not-allowed",
              opacity: loading || !consent ? 0.6 : 1,
            }}
          >
            {loading ? t("analyzing") : t("runAnalysis")}
          </button>
        </form>
        {analysis && (
          <button
            type="button"
            onClick={() => setShowForm(false)}
            style={{ marginTop: 16, background: "none", border: "none", color: "var(--teal)", fontSize: 13, cursor: "pointer" }}
          >
            {t("backToLastResult")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "var(--teal)", textTransform: "uppercase" }}>
          {t("resultsLabel")}{analysis.target_role ? ` — ${analysis.target_role}` : ""}
        </span>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 13,
            color: "var(--text)",
            cursor: "pointer",
          }}
        >
          {t("runNewAnalysis")}
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 24 }}>
        <ScoreRing label={t("overallLabel")} score={analysis.overall_score} />
        <ScoreRing label={t("atsCompatibilityLabel")} score={analysis.ats_score} />
        <ScoreRing label={t("achievementQualityLabel")} score={analysis.achievement_score} />
      </div>

      {analysis.ats_issues.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>{t("atsIssuesTitle")}</h3>
          <ul style={{ margin: 0, paddingInlineStart: 18 }}>
            {analysis.ats_issues.map((issue, i) => (
              <li key={i} style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {(analysis.matched_keywords.length > 0 || analysis.missing_keywords.length > 0) && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>{t("keywordsTitle")}</h3>
          <div>
            {analysis.matched_keywords.map((k) => (
              <Chip key={k} text={k} tone="match" />
            ))}
            {analysis.missing_keywords.map((k) => (
              <Chip key={k} text={k} tone="missing" />
            ))}
          </div>
        </div>
      )}

      {analysis.weak_bullets.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>{t("bulletsTitle")}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {analysis.weak_bullets.map((b, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 12 }}>
                <p style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "line-through", marginBottom: 4 }}>
                  {b.original}
                </p>
                <p style={{ fontSize: 12, color: "var(--amber)", marginBottom: 6 }}>{b.issue}</p>
                <p style={{ fontSize: 13, color: "var(--teal)" }}>{b.rewrite}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.visibility_recommendations.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
            {t("visibilityRecommendationsTitle")}
          </h3>
          <ul style={{ margin: 0, paddingInlineStart: 18 }}>
            {analysis.visibility_recommendations.map((rec, i) => (
              <li key={i} style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 20 }}>
        {t("aiDisclaimer")}
      </p>
    </div>
  );
}
