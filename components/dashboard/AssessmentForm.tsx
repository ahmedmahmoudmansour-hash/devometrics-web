"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { saveAssessmentResult } from "@/app/dashboard/assessments/actions";
import { scoreToBand, type Assessment } from "@/lib/assessments/catalog";
import { caseStudiesForAssessment, buildCaseStudyInsight, type CaseStudyAnswer } from "@/lib/assessments/caseStudies";
import type { CaseStudyResponse } from "@/lib/supabase/types";

const LIKERT = [
  { value: 1, label: "Strongly disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Neutral" },
  { value: 4, label: "Agree" },
  { value: 5, label: "Strongly agree" },
];

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
  resize: "vertical" as const,
};

export default function AssessmentForm({
  assessment,
  careerStage,
}: {
  assessment: Assessment;
  careerStage: string | null;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [step, setStep] = useState<"likert" | "case-studies" | "result">("likert");
  const [likertScore, setLikertScore] = useState(0);
  const [mcqSelections, setMcqSelections] = useState<Record<string, string>>({});
  const [openText, setOpenText] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; insight: string | null } | null>(null);

  const allAnswered = assessment.questions.every((_, i) => answers[i] != null);
  const caseStudies = caseStudiesForAssessment(assessment.slug, careerStage);

  function submitLikert() {
    const ordered = assessment.questions.map((_, i) => answers[i]);
    const avg = ordered.reduce((a, b) => a + b, 0) / ordered.length;
    const score = Math.round(((avg - 1) / 4) * 100);
    setLikertScore(score);
    setStep(caseStudies.length > 0 ? "case-studies" : "result");
    if (caseStudies.length === 0) finalize(score, [], null);
  }

  function finalize(score: number, caseStudyAnswers: CaseStudyAnswer[], insight: string | null) {
    const ordered = assessment.questions.map((_, i) => answers[i]);
    const responses: CaseStudyResponse[] = caseStudyAnswers.map((a) => ({
      caseStudyId: a.caseStudyId,
      type: a.type,
      selectedOptionId: a.selectedOptionId,
      optionScore: a.optionScore,
      openText: a.openText,
      aiScore: a.aiScore,
    }));
    startTransition(async () => {
      await saveAssessmentResult(assessment.slug, score, ordered, responses, insight);
    });
    setResult({ score, insight });
    setStep("result");
  }

  async function submitCaseStudies() {
    setSubmitError(null);
    const mcqCaseStudies = caseStudies.filter((c) => c.type === "mcq");
    const openCaseStudies = caseStudies.filter((c) => c.type === "open");

    if (mcqCaseStudies.some((c) => !mcqSelections[c.id])) {
      setSubmitError("Please answer every case study before continuing.");
      return;
    }

    const answers: CaseStudyAnswer[] = mcqCaseStudies.map((c) => {
      const optionId = mcqSelections[c.id];
      const option = c.type === "mcq" ? c.options.find((o) => o.id === optionId) : undefined;
      return {
        caseStudyId: c.id,
        type: "mcq",
        selectedOptionId: optionId,
        optionScore: option?.score,
      };
    });

    for (const c of openCaseStudies) {
      const text = openText[c.id]?.trim();
      if (!text) continue;
      try {
        const res = await fetch("/api/case-study-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assessmentSlug: assessment.slug, caseStudyId: c.id, responseText: text }),
        });
        if (res.ok) {
          const { score, insight } = await res.json();
          answers.push({ caseStudyId: c.id, type: "open", openText: text, aiScore: score, aiInsight: insight });
        }
      } catch {
        // Open-ended scoring is a bonus, not required — skip silently if it fails.
      }
    }

    const insight = buildCaseStudyInsight(assessment.name, answers);
    finalize(likertScore, answers, insight);
  }

  function skipCaseStudies() {
    finalize(likertScore, [], null);
  }

  if (step === "result" && result) {
    const band = scoreToBand(result.score);
    return (
      <div
        style={{
          background: "var(--navy-mid)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 32,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "var(--teal)", textTransform: "uppercase" }}>
          {assessment.name} — result
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 12 }}>
          <span style={{ fontSize: 44, fontWeight: 800, color: "var(--text)" }}>{result.score}</span>
          <span style={{ fontSize: 16, color: "var(--text-muted)" }}>/ 100 — {band.label}</span>
        </div>
        <p style={{ fontSize: 14, color: "var(--text)", marginTop: 16, lineHeight: 1.7 }}>
          {band.interpretation(assessment.name)}
        </p>

        {result.insight && (
          <div style={{ background: "rgba(0,201,167,0.06)", border: "1px solid rgba(0,201,167,0.2)", borderRadius: 10, padding: 16, marginTop: 20 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "var(--teal)", textTransform: "uppercase", marginBottom: 8 }}>
              Case study insight
            </h3>
            <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7 }}>{result.insight}</p>
          </div>
        )}

        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginTop: 24, marginBottom: 10 }}>
          Suggested next steps
        </h3>
        <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {band.developmentAreas.map((d) => (
            <li key={d} style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
              — {d}
            </li>
          ))}
        </ul>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 24 }}>
          Designed to help you understand yourself better, not to diagnose or label you.
          AI-generated guidance — not a certification.
        </p>
        <Link
          href="/dashboard/assessments"
          style={{
            display: "inline-block",
            marginTop: 20,
            color: "var(--teal)",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          ← Back to all assessments
        </Link>
      </div>
    );
  }

  if (step === "case-studies") {
    return (
      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 32 }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.6 }}>
          A few short scenarios to add real-situation signal beyond the self-report score above —
          how you&apos;d actually handle it, not just how you&apos;d rate yourself.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {caseStudies.map((c, i) => (
            <div key={c.id}>
              <p style={{ fontSize: 15, color: "var(--text)", marginBottom: 12, lineHeight: 1.6 }}>
                {i + 1}. {c.scenario}
              </p>
              {c.type === "mcq" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {c.options.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setMcqSelections((prev) => ({ ...prev, [c.id]: opt.id }))}
                      style={{
                        textAlign: "left",
                        fontSize: 13,
                        padding: "10px 14px",
                        borderRadius: 8,
                        cursor: "pointer",
                        border: mcqSelections[c.id] === opt.id ? "1px solid var(--teal)" : "1px solid rgba(255,255,255,0.1)",
                        background: mcqSelections[c.id] === opt.id ? "rgba(0,201,167,0.12)" : "rgba(255,255,255,0.05)",
                        color: mcqSelections[c.id] === opt.id ? "var(--teal)" : "var(--text)",
                      }}
                    >
                      {opt.text}
                    </button>
                  ))}
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>{c.prompt}</p>
                  <textarea
                    value={openText[c.id] ?? ""}
                    onChange={(e) => setOpenText((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    placeholder="Optional — answer for a deeper, AI-scored insight, or skip it."
                    rows={4}
                    style={inputStyle}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {submitError && <p style={{ color: "#f87171", fontSize: 13, marginTop: 16 }}>{submitError}</p>}

        <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
          <button
            type="button"
            disabled={isPending}
            onClick={submitCaseStudies}
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
            {isPending ? "Scoring…" : "See my full result"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={skipCaseStudies}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            Skip case studies
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--navy-mid)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 32,
      }}
    >
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
        Rate how much each statement reflects you — there are no right answers, just a
        clearer picture of where you stand.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {assessment.questions.map((q, i) => (
          <div key={i}>
            <p style={{ fontSize: 15, color: "var(--text)", marginBottom: 12, lineHeight: 1.6 }}>
              {i + 1}. {q}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {LIKERT.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAnswers((prev) => ({ ...prev, [i]: opt.value }))}
                  style={{
                    fontSize: 13,
                    padding: "8px 14px",
                    borderRadius: 8,
                    cursor: "pointer",
                    border: answers[i] === opt.value ? "1px solid var(--teal)" : "1px solid rgba(255,255,255,0.1)",
                    background: answers[i] === opt.value ? "rgba(0,201,167,0.12)" : "rgba(255,255,255,0.05)",
                    color: answers[i] === opt.value ? "var(--teal)" : "var(--text-muted)",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={!allAnswered || isPending}
        onClick={submitLikert}
        style={{
          marginTop: 32,
          background: "var(--teal)",
          color: "#0A0F1E",
          border: "none",
          borderRadius: 8,
          padding: "12px 24px",
          fontSize: 14,
          fontWeight: 700,
          cursor: allAnswered ? "pointer" : "not-allowed",
          opacity: allAnswered ? 1 : 0.4,
        }}
      >
        {caseStudies.length > 0 ? "Continue to case studies" : "See my score"}
      </button>
    </div>
  );
}
