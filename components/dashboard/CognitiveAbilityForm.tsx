"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitCognitiveAbility } from "@/app/dashboard/assessments/cognitiveAbilityActions";
import {
  COGNITIVE_QUESTIONS,
  COGNITIVE_DOMAINS,
  COGNITIVE_DISCLAIMER,
  cognitiveBandFromScore,
  domainBreakdown,
  type CognitiveDomain,
} from "@/lib/assessments/cognitiveAbility";

export default function CognitiveAbilityForm() {
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; answers: number[] } | null>(null);

  const allAnswered = COGNITIVE_QUESTIONS.every((q) => selections[q.id] !== undefined);

  function submit() {
    setSubmitError(null);
    startTransition(async () => {
      const outcome = await submitCognitiveAbility(selections);
      if (!outcome.success) {
        setSubmitError(outcome.error);
        return;
      }
      setResult({ score: outcome.score, answers: outcome.answers });
    });
  }

  if (result) {
    const band = cognitiveBandFromScore(result.score);
    const breakdown = domainBreakdown(result.answers);
    return (
      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 32 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "var(--teal)", textTransform: "uppercase" }}>
          Cognitive Reasoning — result
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 12 }}>
          <span style={{ fontSize: 44, fontWeight: 800, color: "var(--text)" }}>{band}</span>
          <span style={{ fontSize: 16, color: "var(--text-muted)" }}>{result.score}/100 correct</span>
        </div>

        <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginTop: 24, marginBottom: 10 }}>
          Breakdown by domain
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {breakdown.map((b) => (
            <div key={b.domain} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 130, fontSize: 12.5, fontWeight: 700, color: "var(--text-muted)" }}>{b.domain}</span>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${(b.correct / b.total) * 100}%`,
                    height: "100%",
                    background: b.correct === b.total ? "var(--teal)" : b.correct === 0 ? "#f87171" : "var(--amber)",
                  }}
                />
              </div>
              <span style={{ fontSize: 12, color: "var(--text-muted)", width: 34, textAlign: "right" }}>
                {b.correct}/{b.total}
              </span>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 24, lineHeight: 1.6 }}>
          This is a fixed 54-question snapshot across numerical, verbal, and logical reasoning — not an
          adaptive or certified aptitude battery. {COGNITIVE_DISCLAIMER}
        </p>
        <Link
          href="/dashboard/assessments"
          style={{ display: "inline-block", marginTop: 20, color: "var(--teal)", fontSize: 14, fontWeight: 600, textDecoration: "none" }}
        >
          ← Back to all assessments
        </Link>
      </div>
    );
  }

  const grouped = new Map<CognitiveDomain, typeof COGNITIVE_QUESTIONS>();
  for (const q of COGNITIVE_QUESTIONS) {
    grouped.set(q.domain, [...(grouped.get(q.domain) ?? []), q]);
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 32 }}>
      <div style={{ background: "rgba(240,184,64,0.06)", border: "1px solid rgba(240,184,64,0.25)", borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <p style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.6 }}>{COGNITIVE_DISCLAIMER}</p>
      </div>

      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.6 }}>
        54 questions across numerical, verbal, and logical reasoning. Each has one correct answer —
        this measures reasoning, not job knowledge or vocabulary.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {COGNITIVE_DOMAINS.map((domain) => {
          const questions = grouped.get(domain) ?? [];
          return (
            <div key={domain}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--teal)", marginBottom: 14 }}>
                {domain}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                {questions.map((q) => (
                  <div key={q.id}>
                    {q.passage && (
                      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8, lineHeight: 1.6, fontStyle: "italic" }}>
                        {q.passage}
                      </p>
                    )}
                    <p style={{ fontSize: 14, color: "var(--text)", marginBottom: 10, lineHeight: 1.6 }}>{q.prompt}</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {q.options.map((opt, i) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setSelections((prev) => ({ ...prev, [q.id]: i }))}
                          style={{
                            fontSize: 13,
                            padding: "8px 14px",
                            borderRadius: 8,
                            cursor: "pointer",
                            border: selections[q.id] === i ? "1px solid var(--teal)" : "1px solid rgba(255,255,255,0.1)",
                            background: selections[q.id] === i ? "rgba(0,201,167,0.12)" : "rgba(255,255,255,0.05)",
                            color: selections[q.id] === i ? "var(--teal)" : "var(--text-muted)",
                          }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {submitError && <p style={{ color: "#f87171", fontSize: 13, marginTop: 20 }}>{submitError}</p>}

      <button
        type="button"
        disabled={!allAnswered || isPending}
        onClick={submit}
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
        {isPending ? "Scoring…" : "See my result"}
      </button>
    </div>
  );
}
