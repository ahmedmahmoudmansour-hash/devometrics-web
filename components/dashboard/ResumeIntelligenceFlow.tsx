"use client";

import { useState } from "react";
import FileUploadButton from "@/components/FileUploadButton";
import type { ResumeAnalysis } from "@/lib/supabase/types";

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

function ScoreRing({ label, score }: { label: string; score: number }) {
  const color = score >= 70 ? "var(--teal)" : score >= 40 ? "#f0b840" : "#f87171";
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 32, fontWeight: 800, color }}>{score}</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Chip({ text, tone }: { text: string; tone: "match" | "missing" }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 12,
        padding: "4px 10px",
        borderRadius: 100,
        margin: "0 6px 6px 0",
        background: tone === "match" ? "rgba(0,201,167,0.1)" : "rgba(248,113,113,0.1)",
        color: tone === "match" ? "var(--teal)" : "#f87171",
        border: `1px solid ${tone === "match" ? "rgba(0,201,167,0.3)" : "rgba(248,113,113,0.3)"}`,
      }}
    >
      {text}
    </span>
  );
}

export default function ResumeIntelligenceFlow({ latest }: { latest: ResumeAnalysis | null }) {
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(latest);
  const [showForm, setShowForm] = useState(!latest);
  const [targetRole, setTargetRole] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/resume-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, targetRole, consent }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong");
      }
      const { analysis } = await res.json();
      setAnalysis(analysis);
      setShowForm(false);
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
          Run a resume analysis
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
          Paste your resume text. Add a target role for keyword-gap analysis against it —
          optional, but sharper results if you do.
        </p>
        <form onSubmit={runAnalysis} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input
            type="text"
            aria-label="Target role (optional)"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="Target role (optional), e.g. Senior Product Manager"
            style={inputStyle}
          />
          <div>
            <textarea
              required
              aria-label="Your resume text"
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your resume text…"
              rows={10}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <div style={{ marginTop: 6 }}>
              <FileUploadButton onExtracted={(text) => setResumeText(text)} label="Or upload a PDF/DOCX instead" />
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--text-muted)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              style={{ marginTop: 2, accentColor: "var(--teal)" }}
            />
            <span>
              I consent to Devometrics using AI to analyze the resume I submit here for the
              purpose of generating this analysis.
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
            {loading ? "Analyzing…" : "Run resume analysis"}
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

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "var(--teal)", textTransform: "uppercase" }}>
          Resume Intelligence{analysis.target_role ? ` — ${analysis.target_role}` : ""}
        </span>
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

      <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 24 }}>
        <ScoreRing label="Overall" score={analysis.overall_score} />
        <ScoreRing label="ATS Compatibility" score={analysis.ats_score} />
        <ScoreRing label="Achievement Quality" score={analysis.achievement_score} />
      </div>

      {analysis.ats_issues.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>ATS issues</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {analysis.ats_issues.map((issue, i) => (
              <li key={i} style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {(analysis.matched_keywords.length > 0 || analysis.missing_keywords.length > 0) && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>Keywords</h3>
          <div>
            {analysis.matched_keywords.map((k) => (
              <Chip key={k} text={k} tone="match" />
            ))}
            {analysis.missing_keywords.map((k) => (
              <Chip key={k} text={k} tone="missing" />
            ))}
          </div>
        </div>
      )}

      {analysis.weak_bullets.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>Bullets to strengthen</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {analysis.weak_bullets.map((b, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 12 }}>
                <p style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "line-through", marginBottom: 4 }}>
                  {b.original}
                </p>
                <p style={{ fontSize: 12, color: "#f0b840", marginBottom: 6 }}>{b.issue}</p>
                <p style={{ fontSize: 13, color: "var(--teal)" }}>{b.rewrite}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.visibility_recommendations.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
            Visibility recommendations
          </h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {analysis.visibility_recommendations.map((rec, i) => (
              <li key={i} style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 20 }}>
        AI-generated guidance based on the resume you provided — not a certified
        professional review or a guarantee of interview outcomes.
      </p>
    </div>
  );
}
