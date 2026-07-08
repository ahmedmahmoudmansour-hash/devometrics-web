"use client";

import { useState, useTransition } from "react";
import { saveBigFiveProfile } from "@/app/dashboard/personality/actions";
import { BIG_FIVE_ITEMS, BIG_FIVE_TRAITS, bigFiveInterpretation, type BigFiveTrait } from "@/lib/personality/bigFive";
import type { BigFiveProfile } from "@/lib/supabase/types";

const LIKERT = [
  { value: 1, label: "Strongly disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Neutral" },
  { value: 4, label: "Agree" },
  { value: 5, label: "Strongly agree" },
];

function barColor(score: number): string {
  if (score >= 70) return "#00C9A7";
  if (score >= 40) return "#f0b840";
  return "#f87171";
}

function ScoreBars({ scores }: { scores: Record<BigFiveTrait, number> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {BIG_FIVE_TRAITS.map((trait) => (
        <div key={trait}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{trait}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: barColor(scores[trait]) }}>{scores[trait]}</span>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, marginBottom: 6 }}>
            <div style={{ width: `${scores[trait]}%`, height: "100%", background: barColor(scores[trait]), borderRadius: 3 }} />
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            {bigFiveInterpretation(trait, scores[trait])}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function BigFiveAssessment({ latest }: { latest: BigFiveProfile | null }) {
  const [profile, setProfile] = useState<BigFiveProfile | null>(latest);
  const [retaking, setRetaking] = useState(!latest);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allAnswered = BIG_FIVE_ITEMS.every((item) => answers[item.id] != null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await saveBigFiveProfile(answers);
      if (result.error) {
        setError(result.error);
        return;
      }
      setProfile({
        id: "local",
        user_id: "",
        answers,
        scores: result.scores!,
        created_at: new Date().toISOString(),
      });
      setRetaking(false);
    });
  }

  if (profile && !retaking) {
    return (
      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 12 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Personality snapshot</h2>
          <button
            type="button"
            onClick={() => {
              setRetaking(true);
              setAnswers({});
            }}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 12,
              color: "var(--text)",
              cursor: "pointer",
            }}
          >
            Retake
          </button>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
          Based on the Big Five (OCEAN) model — a self-awareness reference, not a competency score
          to close a gap on.
        </p>
        <ScoreBars scores={profile.scores} />
      </div>
    );
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Personality snapshot</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
        20 short statements, based on the Big Five (OCEAN) model. Rate how much each one reflects
        you generally — there are no right answers, just a clearer picture of your working style.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {BIG_FIVE_ITEMS.map((item, i) => (
          <div key={item.id}>
            <p style={{ fontSize: 14, color: "var(--text)", marginBottom: 10, lineHeight: 1.5 }}>
              {i + 1}. {item.text}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {LIKERT.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAnswers((prev) => ({ ...prev, [item.id]: opt.value }))}
                  style={{
                    fontSize: 12,
                    padding: "7px 12px",
                    borderRadius: 8,
                    cursor: "pointer",
                    border: answers[item.id] === opt.value ? "1px solid var(--teal)" : "1px solid rgba(255,255,255,0.1)",
                    background: answers[item.id] === opt.value ? "rgba(0,201,167,0.12)" : "rgba(255,255,255,0.05)",
                    color: answers[item.id] === opt.value ? "var(--teal)" : "var(--text-muted)",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && <p style={{ color: "#f87171", fontSize: 13, marginTop: 16 }}>{error}</p>}

      <button
        type="button"
        disabled={!allAnswered || isPending}
        onClick={submit}
        style={{
          marginTop: 24,
          background: "var(--teal)",
          color: "#0A0F1E",
          border: "none",
          borderRadius: 8,
          padding: "12px 24px",
          fontSize: 14,
          fontWeight: 700,
          cursor: allAnswered ? "pointer" : "not-allowed",
          opacity: allAnswered && !isPending ? 1 : 0.4,
        }}
      >
        {isPending ? "Scoring…" : "See my snapshot"}
      </button>
    </div>
  );
}
