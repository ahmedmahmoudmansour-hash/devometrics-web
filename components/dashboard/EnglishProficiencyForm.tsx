"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitEnglishProficiency } from "@/app/dashboard/assessments/englishProficiencyActions";
import {
  ENGLISH_PROFICIENCY_QUESTIONS,
  CEFR_DESCRIPTIONS,
  cefrLevelFromScore,
  levelBreakdown,
  type CEFRLevel,
} from "@/lib/assessments/englishProficiency";

const SKILL_LABEL: Record<string, string> = { grammar: "Grammar", vocabulary: "Vocabulary", reading: "Reading" };

export default function EnglishProficiencyForm() {
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; answers: number[] } | null>(null);

  const allAnswered = ENGLISH_PROFICIENCY_QUESTIONS.every((q) => selections[q.id] !== undefined);

  function submit() {
    setSubmitError(null);
    startTransition(async () => {
      const outcome = await submitEnglishProficiency(selections);
      if (!outcome.success) {
        setSubmitError(outcome.error);
        return;
      }
      setResult({ score: outcome.score, answers: outcome.answers });
    });
  }

  if (result) {
    const level = cefrLevelFromScore(result.score);
    const breakdown = levelBreakdown(result.answers);
    return (
      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 32 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "var(--teal)", textTransform: "uppercase" }}>
          English Proficiency — result
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 12 }}>
          <span style={{ fontSize: 44, fontWeight: 800, color: "var(--text)" }}>{level}</span>
          <span style={{ fontSize: 16, color: "var(--text-muted)" }}>
            {CEFR_DESCRIPTIONS[level].label} — {result.score}/100 correct
          </span>
        </div>
        <p style={{ fontSize: 14, color: "var(--text)", marginTop: 16, lineHeight: 1.7 }}>{CEFR_DESCRIPTIONS[level].canDo}</p>

        <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginTop: 24, marginBottom: 10 }}>
          Breakdown by level
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {breakdown.map((b) => (
            <div key={b.level} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 28, fontSize: 12.5, fontWeight: 700, color: "var(--text-muted)" }}>{b.level}</span>
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
          This is a fixed 24-question snapshot (grammar, vocabulary, and reading comprehension), not an
          adaptive or certified exam — treat the {level} result as a directional placement, not an
          official language certification.
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

  const grouped = new Map<CEFRLevel, typeof ENGLISH_PROFICIENCY_QUESTIONS>();
  for (const q of ENGLISH_PROFICIENCY_QUESTIONS) {
    grouped.set(q.level, [...(grouped.get(q.level) ?? []), q]);
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 32 }}>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.6 }}>
        24 questions across grammar, vocabulary, and reading comprehension, ordered from beginner to
        advanced. Unlike the self-report assessments, these have one correct answer each.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {[...grouped.entries()].map(([level, questions]) => (
          <div key={level}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--teal)", marginBottom: 14 }}>
              Level {level} — {CEFR_DESCRIPTIONS[level].label}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {questions.map((q) => (
                <div key={q.id}>
                  {q.passage && (
                    <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8, lineHeight: 1.6, fontStyle: "italic" }}>
                      {q.passage}
                    </p>
                  )}
                  <p style={{ fontSize: 14, color: "var(--text)", marginBottom: 10, lineHeight: 1.6 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", marginRight: 8 }}>
                      {SKILL_LABEL[q.skill]}
                    </span>
                    {q.prompt}
                  </p>
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
        ))}
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
        {isPending ? "Scoring…" : "See my level"}
      </button>
    </div>
  );
}
