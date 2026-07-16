"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { generateBridgeContent } from "@/app/dashboard/gap-analysis/bridgeActions";
import type { BridgeContent } from "@/lib/learning/bridgeContent";

const card: React.CSSProperties = {
  background: "var(--navy-mid)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: 24,
};

function KnowledgeCheck({ questions }: { questions: BridgeContent["microLesson"]["knowledgeCheck"] }) {
  const [selections, setSelections] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState(false);

  const correctCount = questions.filter((q, i) => selections[i] === q.correctIndex).length;

  return (
    <div className="print-avoid-break" style={{ ...card, marginTop: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--teal)", marginBottom: 14 }}>
        Knowledge check
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {questions.map((q, qi) => (
          <div key={qi}>
            <p style={{ fontSize: 13.5, color: "var(--text)", marginBottom: 8, lineHeight: 1.5 }}>
              {qi + 1}. {q.question}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {q.options.map((opt, oi) => {
                const isSelected = selections[qi] === oi;
                const showResult = checked;
                const isCorrectOpt = oi === q.correctIndex;
                let borderColor = "rgba(255,255,255,0.1)";
                let bg = "rgba(255,255,255,0.05)";
                let color = "var(--text-muted)";
                if (isSelected && !showResult) {
                  borderColor = "var(--teal)";
                  bg = "rgba(0,201,167,0.12)";
                  color = "var(--teal)";
                }
                if (showResult && isCorrectOpt) {
                  borderColor = "var(--teal)";
                  bg = "rgba(0,201,167,0.12)";
                  color = "var(--teal)";
                }
                if (showResult && isSelected && !isCorrectOpt) {
                  borderColor = "#f87171";
                  bg = "rgba(248,113,113,0.1)";
                  color = "#f87171";
                }
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={checked}
                    onClick={() => setSelections((prev) => ({ ...prev, [qi]: oi }))}
                    className="no-print"
                    style={{
                      fontSize: 12.5,
                      padding: "7px 12px",
                      borderRadius: 8,
                      cursor: checked ? "default" : "pointer",
                      border: `1px solid ${borderColor}`,
                      background: bg,
                      color,
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {!checked ? (
        <button
          type="button"
          className="no-print"
          disabled={Object.keys(selections).length < questions.length}
          onClick={() => setChecked(true)}
          style={{
            marginTop: 16,
            background: "var(--teal)",
            color: "#0A0F1E",
            border: "none",
            borderRadius: 8,
            padding: "9px 16px",
            fontSize: 13,
            fontWeight: 700,
            cursor: Object.keys(selections).length < questions.length ? "not-allowed" : "pointer",
            opacity: Object.keys(selections).length < questions.length ? 0.4 : 1,
          }}
        >
          Check my answers
        </button>
      ) : (
        <p className="no-print" style={{ marginTop: 14, fontSize: 13, color: "var(--text)" }}>
          {correctCount}/{questions.length} correct — this is a formative self-check, not a graded
          score.
        </p>
      )}
    </div>
  );
}

export default function BridgeContentView({
  dimension,
  currentLevel,
  targetLevel,
  cached,
  generatedAt,
}: {
  dimension: string;
  currentLevel: number;
  targetLevel: number;
  cached: BridgeContent | null;
  generatedAt: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await generateBridgeContent(dimension);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (!cached) {
    return (
      <div style={card}>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 16 }}>
          Currently measured at <strong style={{ color: "var(--text)" }}>{currentLevel}/100</strong>,
          targeting <strong style={{ color: "var(--text)" }}>{targetLevel}/100</strong>. Generate a
          short lesson, one clear next step, a self-check, and real free resources — built for this
          gap specifically, not pulled from a shared catalog.
        </p>
        {error && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <button
          type="button"
          onClick={generate}
          disabled={isPending}
          style={{
            background: "var(--teal)",
            color: "#0A0F1E",
            border: "none",
            borderRadius: 8,
            padding: "11px 20px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? "Writing your content…" : "▶ Generate bridge content"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="no-print" style={{ marginBottom: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => window.print()}
          style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          Download as PDF
        </button>
        <button
          type="button"
          onClick={generate}
          disabled={isPending}
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 700, color: "var(--text)", cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
        >
          {isPending ? "Regenerating…" : "↻ Regenerate"}
        </button>
        <Link
          href="/dashboard/gap-analysis"
          style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textDecoration: "none" }}
        >
          Re-run Gap Analysis to measure progress →
        </Link>
      </div>
      {error && <p className="no-print" style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <div className="print-plan" style={{ ...card, padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <span className="print-accent" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "var(--teal)", textTransform: "uppercase" }}>
            Devometrics
          </span>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            Bridging: {dimension} · {currentLevel} → {targetLevel}
          </p>
          {generatedAt && (
            <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>
              Generated {new Date(generatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>

        <div className="print-avoid-break" style={{ background: "rgba(240,184,64,0.06)", border: "1px solid rgba(240,184,64,0.25)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--amber)", marginBottom: 6 }}>
            Why this gap might exist
          </p>
          <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>{cached.diagnosticNote}</p>
        </div>

        <div className="print-avoid-break" style={{ background: "rgba(0,201,167,0.06)", border: "1px solid rgba(0,201,167,0.25)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--teal)", marginBottom: 6 }}>
            Your one next step
          </p>
          <p style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.6 }}>{cached.recommendedActivity}</p>
        </div>

        <div className="print-avoid-break" style={card}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
            {cached.microLesson.title}
          </h2>
          <p style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.75, marginTop: 12, whiteSpace: "pre-wrap" }}>
            {cached.microLesson.body}
          </p>
        </div>

        <KnowledgeCheck questions={cached.microLesson.knowledgeCheck} />

        <div className="print-avoid-break" style={{ ...card, marginTop: 16, borderLeft: "3px solid var(--teal)" }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--teal)", marginBottom: 6 }}>
            Reflect
          </p>
          <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>{cached.reflectionQuestion}</p>
        </div>

        {cached.externalResources.length > 0 && (
          <div className="print-avoid-break" style={{ ...card, marginTop: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>
              Verified resources
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {cached.externalResources.map((r) => (
                <div key={r.url}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13.5, fontWeight: 700, color: "var(--teal)", textDecoration: "none" }}>
                    {r.title} ↗
                  </a>
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{r.source}</p>
                  <p style={{ fontSize: 12.5, color: "var(--text)", marginTop: 3, lineHeight: 1.5 }}>{r.description}</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 12 }}>
              Found via a live web search when this was generated — verify a link still works before
              relying on it, since pages can move or go offline over time.
            </p>
          </div>
        )}

        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 24, textAlign: "center" }}>
          AI-generated development content by Devometrics — a starting point for closing this gap,
          not a certified curriculum. Re-run your Gap Analysis after practicing to see if your
          measured score actually moved.
        </p>
      </div>
    </div>
  );
}
