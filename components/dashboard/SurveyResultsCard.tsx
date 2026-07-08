"use client";

import { useState, useTransition } from "react";
import { getSurveyResults, type OrgSurveySummary, type SurveyResults } from "@/lib/surveys/actions";

export default function SurveyResultsCard({ survey }: { survey: OrgSurveySummary }) {
  const [expanded, setExpanded] = useState(false);
  const [results, setResults] = useState<SurveyResults | { error: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    if (!expanded && !results) {
      startTransition(async () => {
        setResults(await getSurveyResults(survey.id));
      });
    }
    setExpanded((prev) => !prev);
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{survey.title}</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            {survey.theme} · {survey.responseCount ?? 0} of {survey.assignedCount} responded
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "var(--teal)", cursor: "pointer" }}
        >
          {expanded ? "Hide results" : "View results"}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          {isPending && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading…</p>}
          {results && "error" in results && <p style={{ fontSize: 12, color: "#f87171" }}>{results.error}</p>}
          {results && "status" in results && results.status === "insufficient_data" && (
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Only {results.responseCount} of {survey.assignedCount} have responded so far — results stay
              hidden until at least 3 people respond, to keep answers anonymous.
            </p>
          )}
          {results && "status" in results && results.status === "ready" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Aggregated across {results.responseCount} anonymous responses.
              </p>
              {results.aggregates.map((a) => (
                <div key={a.questionId}>
                  <p style={{ fontSize: 13, color: "var(--text)", marginBottom: 6 }}>{a.text}</p>
                  {a.type === "rating" ? (
                    <p style={{ fontSize: 20, fontWeight: 800, color: "var(--teal)" }}>
                      {a.average}
                      <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)" }}> / 5 avg ({a.count} responses)</span>
                    </p>
                  ) : a.type === "multiple_choice" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {Object.entries(a.optionCounts).map(([option, count]) => (
                        <div key={option} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span style={{ color: "var(--text-muted)" }}>{option}</span>
                          <span style={{ color: "var(--text)", fontWeight: 700 }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  ) : a.count === 0 ? (
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No responses to this question yet.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {a.responses.map((text, idx) => (
                        <p
                          key={idx}
                          style={{ fontSize: 12, color: "var(--text)", background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 10px", lineHeight: 1.5 }}
                        >
                          &ldquo;{text}&rdquo;
                        </p>
                      ))}
                      <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>
                        Shown in random order, anonymized — but open text can still self-identify someone
                        through its content (e.g. naming a specific person or shift).
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
