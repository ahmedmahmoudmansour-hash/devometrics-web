"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import CompetencyRadar from "./CompetencyRadar";
import PlanOptionsReview from "./PlanOptionsReview";
import FileUploadButton from "@/components/FileUploadButton";
import { generatePlanFromAnalysis } from "@/app/dashboard/gap-analysis/actions";
import { updateProfile } from "@/app/dashboard/actions";
import PersonalizationFields, { type PersonalizationValues } from "@/components/dashboard/PersonalizationFields";
import type { LearningFormat } from "@/lib/gap-analysis/actionLibrary";
import { rankByImpact } from "@/lib/gap-analysis/dimensions";
import { HORIZONS, type Horizon } from "@/lib/gap-analysis/horizons";
import type { GapAnalysis } from "@/lib/supabase/types";

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

const priorityColor: Record<string, string> = {
  high: "#f87171",
  medium: "#f0b840",
  low: "var(--text-muted)",
};

export default function GapAnalysisFlow({
  latest,
  personalization,
}: {
  latest: GapAnalysis | null;
  personalization: PersonalizationValues;
}) {
  const t = useTranslations("gapAnalysisFlow");
  const [analysis, setAnalysis] = useState<GapAnalysis | null>(latest);
  const [showForm, setShowForm] = useState(!latest);
  const [targetRole, setTargetRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [cvText, setCvText] = useState("");
  const [performanceData, setPerformanceData] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [createdPlanId, setCreatedPlanId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [horizon, setHorizon] = useState<Horizon>("90-day");
  const [values, setValues] = useState<PersonalizationValues>(personalization);

  async function runAnalysis(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gap-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole, jobDescription, cvText, performanceData, consent }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || t("errorFallback"));
      }
      const { analysis } = await res.json();
      setAnalysis(analysis);
      setShowForm(false);
      setCreatedPlanId(null);
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
            required
            aria-label={t("targetRoleAria")}
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder={t("targetRolePlaceholder")}
            style={inputStyle}
          />
          <div>
            <textarea
              aria-label={t("jobDescAria")}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder={t("jobDescPlaceholder")}
              rows={5}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
              {t("jobDescHint")}
            </p>
          </div>
          <div>
            <textarea
              required
              aria-label={t("cvAria")}
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
              placeholder={t("cvPlaceholder")}
              rows={8}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <div style={{ marginTop: 6 }}>
              <FileUploadButton onExtracted={(text) => setCvText(text)} label={t("uploadLabel")} />
            </div>
          </div>
          <div>
            <textarea
              aria-label={t("perfDataAria")}
              value={performanceData}
              onChange={(e) => setPerformanceData(e.target.value)}
              placeholder={t("perfDataPlaceholder")}
              rows={5}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              {t("perfDataHint")}
            </p>
          </div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--text-muted)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              style={{ marginTop: 2, accentColor: "var(--teal)" }}
            />
            <span>
              {t("consentLabel")}
            </span>
          </label>
          {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}
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

  const ranked = rankByImpact(analysis.competencies);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "var(--teal)", textTransform: "uppercase" }}>
              {t("gapAnalysisLabel", { role: analysis.target_role })}
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: "var(--text)" }}>
                {analysis.career_health_score}
              </span>
              <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{t("careerHealthScoreLabel")}</span>
            </div>
          </div>
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

        <div style={{ maxWidth: 340, margin: "0 auto" }}>
          <CompetencyRadar competencies={analysis.competencies} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {ranked.map((c, i) => (
            <div
              key={c.dimension}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: "1px solid var(--border)",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 14, color: "var(--text)", fontWeight: 600 }}>{c.dimension}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{c.rationale}</div>
                <Link
                  href={`/dashboard/gap-analysis/bridge/${encodeURIComponent(c.dimension)}`}
                  style={{
                    display: "inline-block",
                    marginTop: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--teal)",
                    textDecoration: "none",
                  }}
                >
                  {i === 0 ? t("bridgeGapHighest") : t("bridgeGap")}
                </Link>
              </div>
              <div style={{ textAlign: "end", flexShrink: 0, marginInlineStart: 16 }}>
                <div style={{ fontSize: 13, color: "var(--text)" }}>
                  {c.currentLevel} → {c.targetLevel}
                </div>
                <div style={{ fontSize: 11, color: "var(--teal)", fontWeight: 700 }}>
                  {t("impactLabel", { value: c.impact })}
                </div>
                <div style={{ fontSize: 11, color: priorityColor[c.priority], fontWeight: 700, textTransform: "uppercase" }}>
                  {t("confidenceLabel", { priority: c.priority, confidence: c.confidence })}
                </div>
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 20 }}>
          {t("impactExplanation")}
        </p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
          {t("aiDisclaimer")}
        </p>
      </div>

      {reviewOpen ? (
        <PlanOptionsReview
          analysisId={analysis.id}
          targetRole={analysis.target_role}
          horizon={horizon}
          defaultFormat={(values.learningPreferences[0] as LearningFormat) ?? null}
          onDone={(planId) => {
            setReviewOpen(false);
            setCreatedPlanId(planId);
          }}
        />
      ) : (
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
          {createdPlanId ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span
                style={{
                  background: "rgba(0,201,167,0.1)",
                  color: "var(--teal)",
                  border: "1px solid rgba(0,201,167,0.3)",
                  borderRadius: 8,
                  padding: "12px 24px",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {t("planCreated")}
              </span>
              <Link
                href={`/dashboard/plans/${createdPlanId}`}
                style={{
                  background: "var(--teal)",
                  color: "#0A0F1E",
                  borderRadius: 8,
                  padding: "12px 24px",
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                {t("viewMyPlan")}
              </Link>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 20 }}>
                <PersonalizationFields value={values} onChange={setValues} showCareerStage={false} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label htmlFor="plan-horizon" style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 8 }}>
                  {t("planHorizonLabel")}
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} id="plan-horizon">
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
              </div>

              {error && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</p>}

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await updateProfile(values.location, values.learningPreferences, values.careerStage, values.accommodation, values.resourceTier);
                      const result = await generatePlanFromAnalysis(analysis.id, horizon);
                      if (result?.planId) setCreatedPlanId(result.planId);
                      else setError(result?.error ?? "Something went wrong");
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
                  {isPending ? t("creatingPlan") : t("autoGeneratePlan")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      await updateProfile(values.location, values.learningPreferences, values.careerStage, values.accommodation, values.resourceTier);
                      setReviewOpen(true);
                    })
                  }
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "12px 24px",
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--text)",
                    cursor: "pointer",
                  }}
                >
                  {t("customizePerSkill")}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
