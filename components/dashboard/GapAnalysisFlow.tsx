"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import CompetencyRadar from "./CompetencyRadar";
import PlanOptionsReview from "./PlanOptionsReview";
import FileUploadButton from "@/components/FileUploadButton";
import { generatePlanFromAnalysis } from "@/app/dashboard/gap-analysis/actions";
import { updateLearningPreferences } from "@/app/dashboard/actions";
import { LEARNING_FORMATS, LEARNING_FORMAT_DESCRIPTIONS, type LearningFormat } from "@/lib/gap-analysis/actionLibrary";
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
  learningPreferences,
}: {
  latest: GapAnalysis | null;
  learningPreferences: string[];
}) {
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
  const [selectedFormats, setSelectedFormats] = useState<string[]>(learningPreferences);

  function toggleFormat(format: string) {
    setSelectedFormats((prev) => (prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format]));
  }

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
        throw new Error(body.error || "Something went wrong");
      }
      const { analysis } = await res.json();
      setAnalysis(analysis);
      setShowForm(false);
      setCreatedPlanId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (showForm || !analysis) {
    return (
      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
          Run a gap analysis
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
          Paste your background — a CV if you have one, or coursework/class projects/
          internships if you don&apos;t — plus the role you&apos;re aiming for. The engine
          scores you against it across 8 fixed dimensions either way.
        </p>
        <form onSubmit={runAnalysis} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input
            type="text"
            required
            aria-label="Target role"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="Target role, e.g. Senior Product Manager"
            style={inputStyle}
          />
          <div>
            <textarea
              aria-label="Target job description"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the target job description if you have one…"
              rows={5}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
              No job description handy? Leave this blank — we&apos;ll infer typical responsibilities
              for the role you named above, and flag that clearly in your results.
            </p>
          </div>
          <div>
            <textarea
              required
              aria-label="Your CV, coursework, or project experience"
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
              placeholder="Paste your CV, coursework, class projects, or internship experience…"
              rows={8}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <div style={{ marginTop: 6 }}>
              <FileUploadButton onExtracted={(text) => setCvText(text)} label="Or upload a PDF/DOCX instead" />
            </div>
          </div>
          <div>
            <textarea
              aria-label="Performance review data or objectives (optional)"
              value={performanceData}
              onChange={(e) => setPerformanceData(e.target.value)}
              placeholder="Optional: paste performance review data or stated objectives — often more specific evidence than a CV, especially if you're an employed professional…"
              rows={5}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              Optional — most useful if you have performance review content. Skip it if you don&apos;t.
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
              I consent to Devometrics using AI to analyze the background material I
              submit here for the purpose of generating this gap analysis.
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
            {loading ? "Analyzing…" : "Run gap analysis"}
          </button>
        </form>
        {analysis && (
          <button
            type="button"
            onClick={() => setShowForm(false)}
            style={{ marginTop: 16, background: "none", border: "none", color: "var(--teal)", fontSize: 13, cursor: "pointer" }}
          >
            ← Back to last result
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
              Gap analysis — {analysis.target_role}
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: "var(--text)" }}>
                {analysis.career_health_score}
              </span>
              <span style={{ fontSize: 14, color: "var(--text-muted)" }}>Career Health Score</span>
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
            Run new analysis
          </button>
        </div>

        <div style={{ maxWidth: 340, margin: "0 auto" }}>
          <CompetencyRadar competencies={analysis.competencies} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {ranked.map((c) => (
            <div
              key={c.dimension}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div>
                <div style={{ fontSize: 14, color: "var(--text)", fontWeight: 600 }}>{c.dimension}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{c.rationale}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                <div style={{ fontSize: 13, color: "var(--text)" }}>
                  {c.currentLevel} → {c.targetLevel}
                </div>
                <div style={{ fontSize: 11, color: "var(--teal)", fontWeight: 700 }}>
                  Impact {c.impact}
                </div>
                <div style={{ fontSize: 11, color: priorityColor[c.priority], fontWeight: 700, textTransform: "uppercase" }}>
                  {c.priority} · {c.confidence}% confidence
                </div>
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 20 }}>
          Impact Score = gap size × role importance × market demand × confidence.
          A large gap only ranks high if it also matters for the role, is in demand,
          and the AI is actually confident about it — ranked highest first.
        </p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
          AI-generated guidance based on the CV and job description you provided — not a
          certified psychometric evaluation or a guarantee of career outcomes.
        </p>
      </div>

      {reviewOpen ? (
        <PlanOptionsReview
          analysisId={analysis.id}
          targetRole={analysis.target_role}
          horizon={horizon}
          defaultFormat={(selectedFormats[0] as LearningFormat) ?? null}
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
                Development plan created ✓
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
                View my plan →
              </Link>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 8 }}>
                  How do you want to learn?
                </label>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, lineHeight: 1.5 }}>
                  Pick as many as apply — this also updates your saved preference for next time. Hover a pill
                  for what it means.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {LEARNING_FORMATS.map((format) => {
                    const checked = selectedFormats.includes(format);
                    return (
                      <button
                        key={format}
                        type="button"
                        onClick={() => toggleFormat(format)}
                        title={LEARNING_FORMAT_DESCRIPTIONS[format]}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 100,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          border: checked ? "1px solid rgba(0,201,167,0.4)" : "1px solid var(--border)",
                          background: checked ? "rgba(0,201,167,0.12)" : "rgba(255,255,255,0.05)",
                          color: checked ? "var(--teal)" : "var(--text-muted)",
                        }}
                      >
                        {format}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label htmlFor="plan-horizon" style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 8 }}>
                  Plan horizon
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
                      const prefResult = await updateLearningPreferences(selectedFormats);
                      if (prefResult?.error) {
                        setError(`Couldn't save your learning preference (${prefResult.error}) — generating the plan with your last saved preference instead.`);
                      }
                      const result = await generatePlanFromAnalysis(analysis.id, horizon);
                      if (result?.planId) setCreatedPlanId(result.planId);
                      else if (!prefResult?.error) setError(result?.error ?? "Something went wrong");
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
                  {isPending ? "Creating plan…" : "Auto-generate plan"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      const prefResult = await updateLearningPreferences(selectedFormats);
                      if (prefResult?.error) {
                        setError(`Couldn't save your learning preference (${prefResult.error}).`);
                      }
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
                  Customize per skill instead
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
