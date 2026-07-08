"use client";

import { useState, useTransition } from "react";
import { submitSurveyResponse, type MySurvey } from "@/lib/surveys/actions";
import type { SurveyAnswers } from "@/lib/surveys/types";

function SurveyForm({ survey, onDone }: { survey: MySurvey; onDone: () => void }) {
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allAnswered = survey.questions.every((q) => answers[q.id] !== undefined);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await submitSurveyResponse(survey.id, answers);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onDone();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>
      {survey.questions.map((q) => (
        <div key={q.id}>
          <p style={{ fontSize: 13, color: "var(--text)", marginBottom: 8 }}>{q.text}</p>
          {q.type === "qualitative" ? (
            <textarea
              value={(answers[q.id] as string) ?? ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              placeholder="Your answer"
              rows={3}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 13,
                color: "var(--text)",
                outline: "none",
                resize: "vertical",
              }}
            />
          ) : q.type === "rating" ? (
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: n }))}
                  aria-pressed={answers[q.id] === n}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    border: answers[q.id] === n ? "1px solid rgba(0,201,167,0.4)" : "1px solid var(--border)",
                    background: answers[q.id] === n ? "rgba(0,201,167,0.12)" : "rgba(255,255,255,0.05)",
                    color: answers[q.id] === n ? "var(--teal)" : "var(--text-muted)",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(q.options ?? []).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                  aria-pressed={answers[q.id] === opt}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 100,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: answers[q.id] === opt ? "1px solid rgba(0,201,167,0.4)" : "1px solid var(--border)",
                    background: answers[q.id] === opt ? "rgba(0,201,167,0.12)" : "rgba(255,255,255,0.05)",
                    color: answers[q.id] === opt ? "var(--teal)" : "var(--text-muted)",
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      {error && <p style={{ color: "#f87171", fontSize: 12 }}>{error}</p>}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!allAnswered || isPending}
        style={{
          alignSelf: "flex-start",
          background: "var(--teal)",
          color: "#0A0F1E",
          border: "none",
          borderRadius: 8,
          padding: "8px 16px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          opacity: !allAnswered || isPending ? 0.5 : 1,
        }}
      >
        {isPending ? "Submitting…" : "Submit anonymously"}
      </button>
    </div>
  );
}

export default function PendingSurveysCard({ surveys: initialSurveys }: { surveys: MySurvey[] }) {
  const [surveys, setSurveys] = useState(initialSurveys);
  const [openId, setOpenId] = useState<string | null>(null);

  if (surveys.length === 0) return null;

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
        {surveys.length === 1 ? "You have a survey" : `You have ${surveys.length} surveys`}
      </h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
        From your organization — completely anonymous, never tied back to you.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {surveys.map((s) => (
          <div key={s.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{s.title}</span>
              <button
                type="button"
                onClick={() => setOpenId((prev) => (prev === s.id ? null : s.id))}
                style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 12px", fontSize: 12, color: "var(--teal)", cursor: "pointer" }}
              >
                {openId === s.id ? "Close" : "Answer"}
              </button>
            </div>
            {openId === s.id && (
              <SurveyForm
                survey={s}
                onDone={() => {
                  setSurveys((prev) => prev.filter((x) => x.id !== s.id));
                  setOpenId(null);
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
