"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { startExerciseAttempt, submitExerciseAttempt } from "@/app/dashboard/assessments/exerciseActions";
import type { CaseStudyExercise } from "@/lib/assessments/caseStudyExercises";
import type { ExerciseReport } from "@/lib/assessments/scoreCaseStudyExercise";

function TimerRing({ secondsLeft, totalSeconds }: { secondsLeft: number; totalSeconds: number }) {
  const size = 88;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, secondsLeft / totalSeconds);
  const color = pct > 0.5 ? "#00C9A7" : pct > 0.2 ? "#f0b840" : "#f87171";
  const mm = Math.floor(Math.max(0, secondsLeft) / 60);
  const ss = Math.max(0, secondsLeft) % 60;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s ease" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          fontWeight: 800,
          color,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {mm}:{ss.toString().padStart(2, "0")}
      </div>
    </div>
  );
}

function ReportCard({ exercise, report }: { exercise: CaseStudyExercise; report: ExerciseReport }) {
  const color = report.score >= 70 ? "#00C9A7" : report.score >= 40 ? "#f0b840" : "#f87171";
  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 32 }}>
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "var(--teal)", textTransform: "uppercase" }}>
        {exercise.title} — result
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 12 }}>
        <span style={{ fontSize: 48, fontWeight: 800, color }}>{report.score}</span>
        <span style={{ fontSize: 16, color: "var(--text-muted)" }}>/ 100 — {exercise.dimension}</span>
      </div>

      <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <div style={{ background: "rgba(0,201,167,0.06)", border: "1px solid rgba(0,201,167,0.2)", borderRadius: 10, padding: 16 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "var(--teal)", textTransform: "uppercase", marginBottom: 10 }}>
            Strengths
          </h3>
          <ul style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 18 }}>
            {report.strengths.map((s, i) => (
              <li key={i} style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>{s}</li>
            ))}
          </ul>
        </div>
        <div style={{ background: "rgba(240,184,64,0.06)", border: "1px solid rgba(240,184,64,0.2)", borderRadius: 10, padding: 16 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "var(--amber)", textTransform: "uppercase", marginBottom: 10 }}>
            Gaps
          </h3>
          <ul style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 18 }}>
            {report.gaps.map((g, i) => (
              <li key={i} style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>{g}</li>
            ))}
          </ul>
        </div>
      </div>

      <div style={{ marginTop: 20, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 16 }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>
          What to sharpen next
        </h3>
        <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.7 }}>{report.recommendation}</p>
      </div>

      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 24 }}>
        AI-generated feedback on a single timed exercise — a directional read, not a certified assessment.
      </p>
      <Link href="/dashboard/assessments" style={{ display: "inline-block", marginTop: 16, color: "var(--teal)", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
        ← Back to Assessment Center
      </Link>
    </div>
  );
}

export default function ExerciseAttempt({ exercise }: { exercise: CaseStudyExercise }) {
  const totalSeconds = exercise.timeLimitMinutes * 60;
  const [phase, setPhase] = useState<"intro" | "active" | "done">("intro");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [report, setReport] = useState<ExerciseReport | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase !== "active") return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phase]);

  async function handleStart() {
    setError(null);
    const result = await startExerciseAttempt(exercise.slug);
    if (result.error) {
      setError(result.error);
      return;
    }
    setAttemptId(result.attemptId ?? null);
    setPhase("active");
  }

  async function handleSubmit() {
    if (!attemptId) return;
    setSubmitting(true);
    setError(null);
    const result = await submitExerciseAttempt(attemptId, exercise.slug, response);
    setSubmitting(false);
    if (result.error || !result.report) {
      setError(result.error ?? "Something went wrong — try again.");
      return;
    }
    setReport(result.report);
    setPhase("done");
  }

  if (phase === "done" && report) {
    return <ReportCard exercise={exercise} report={report} />;
  }

  if (phase === "intro") {
    return (
      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 32 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--teal)", textTransform: "uppercase" }}>
          {exercise.dimension} · {exercise.level}
        </span>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginTop: 8, marginBottom: 16 }}>
          {exercise.title}
        </h1>
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.7 }}>{exercise.context}</p>
        </div>
        <p style={{ fontSize: 14, color: "var(--teal)", fontWeight: 600, lineHeight: 1.6, marginBottom: 24 }}>
          {exercise.prompt}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--amber)",
              background: "rgba(240,184,64,0.1)",
              border: "1px solid rgba(240,184,64,0.3)",
              borderRadius: 100,
              padding: "6px 14px",
            }}
          >
            {exercise.timeLimitMinutes} minutes once you start
          </span>
        </div>
        {error && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 16 }}>{error}</p>}
        <button
          type="button"
          onClick={handleStart}
          style={{
            background: "var(--teal)",
            color: "#0A0F1E",
            border: "none",
            borderRadius: 8,
            padding: "12px 28px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Start the clock
        </button>
      </div>
    );
  }

  const timeUp = secondsLeft <= 0;

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--teal)", textTransform: "uppercase" }}>
            {exercise.dimension} · {exercise.level}
          </span>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginTop: 6 }}>{exercise.title}</h1>
        </div>
        <TimerRing secondsLeft={secondsLeft} totalSeconds={totalSeconds} />
      </div>

      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7 }}>{exercise.context}</p>
      </div>
      <p style={{ fontSize: 14, color: "var(--teal)", fontWeight: 600, lineHeight: 1.6, marginBottom: 16 }}>
        {exercise.prompt}
      </p>

      {timeUp && (
        <p style={{ fontSize: 13, color: "var(--amber)", marginBottom: 12 }}>
          Time&apos;s up — you can still submit whenever you&apos;re ready, just try to wrap up.
        </p>
      )}

      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Write your response here…"
        rows={10}
        style={{
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
        }}
      />

      {error && <p style={{ color: "#f87171", fontSize: 13, marginTop: 12 }}>{error}</p>}

      <button
        type="button"
        disabled={submitting}
        onClick={handleSubmit}
        style={{
          marginTop: 16,
          background: "var(--teal)",
          color: "#0A0F1E",
          border: "none",
          borderRadius: 8,
          padding: "12px 28px",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          opacity: submitting ? 0.6 : 1,
        }}
      >
        {submitting ? "Scoring…" : "Submit for feedback"}
      </button>
    </div>
  );
}
