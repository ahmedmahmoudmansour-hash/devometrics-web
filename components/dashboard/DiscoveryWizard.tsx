"use client";

import { useState } from "react";
import { DISCOVERY_QUESTIONS } from "@/lib/discovery/questions";
import type { DiscoveryProfile } from "@/lib/supabase/types";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "12px 16px",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
  fontFamily: "inherit",
  resize: "vertical",
};

export default function DiscoveryWizard({ latest }: { latest: DiscoveryProfile | null }) {
  const [profile, setProfile] = useState<DiscoveryProfile | null>(latest);
  const [retaking, setRetaking] = useState(!latest);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(Array(DISCOVERY_QUESTIONS.length).fill(""));
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (profile && !retaking) {
    return (
      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "var(--teal)", textTransform: "uppercase" }}>
            Your discovery profile
          </span>
          <button
            type="button"
            onClick={() => {
              setRetaking(true);
              setStep(0);
              setAnswers(Array(DISCOVERY_QUESTIONS.length).fill(""));
            }}
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
            Retake
          </button>
        </div>
        <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
          {profile.summary}
        </p>
      </div>
    );
  }

  const isLastStep = step === DISCOVERY_QUESTIONS.length - 1;
  const currentAnswer = answers[step];

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const payload = DISCOVERY_QUESTIONS.map((q, i) => ({ question: q, answer: answers[i] }));
      const res = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: payload, consent }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong");
      }
      const { profile } = await res.json();
      setProfile(profile);
      setRetaking(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Question {step + 1} of {DISCOVERY_QUESTIONS.length}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          {DISCOVERY_QUESTIONS.map((_, i) => (
            <span
              key={i}
              style={{
                width: 24,
                height: 4,
                borderRadius: 2,
                background: i <= step ? "var(--teal)" : "rgba(255,255,255,0.1)",
              }}
            />
          ))}
        </div>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
        {DISCOVERY_QUESTIONS[step]}
      </h2>

      <textarea
        aria-label={DISCOVERY_QUESTIONS[step]}
        value={currentAnswer}
        onChange={(e) => {
          const next = [...answers];
          next[step] = e.target.value;
          setAnswers(next);
        }}
        placeholder="Answer in your own words…"
        rows={5}
        style={inputStyle}
      />

      {isLastStep && (
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--text-muted)", cursor: "pointer", marginTop: 14 }}>
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            style={{ marginTop: 2, accentColor: "var(--teal)" }}
          />
          <span>I consent to Devometrics using AI to synthesize a profile summary from these answers.</span>
        </label>
      )}

      {error && <p style={{ color: "#f87171", fontSize: 13, marginTop: 12 }}>{error}</p>}

      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
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
            Back
          </button>
        )}
        {isLastStep ? (
          <button
            type="button"
            disabled={!currentAnswer.trim() || !consent || loading}
            onClick={submit}
            style={{
              background: "var(--teal)",
              color: "#0A0F1E",
              border: "none",
              borderRadius: 8,
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 700,
              cursor: currentAnswer.trim() && consent ? "pointer" : "not-allowed",
              opacity: loading || !currentAnswer.trim() || !consent ? 0.6 : 1,
            }}
          >
            {loading ? "Synthesizing…" : "Finish"}
          </button>
        ) : (
          <button
            type="button"
            disabled={!currentAnswer.trim()}
            onClick={() => setStep(step + 1)}
            style={{
              background: "var(--teal)",
              color: "#0A0F1E",
              border: "none",
              borderRadius: 8,
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 700,
              cursor: currentAnswer.trim() ? "pointer" : "not-allowed",
              opacity: currentAnswer.trim() ? 1 : 0.6,
            }}
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
