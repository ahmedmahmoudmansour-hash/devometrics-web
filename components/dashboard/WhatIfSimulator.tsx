"use client";

import { useState, useTransition } from "react";
import { simulateTargetRoleChange, simulateDimensionImprovement, type WhatIfResult } from "@/lib/careerGps/whatIf";
import { COMPETENCY_DIMENSIONS, type CompetencyDimension } from "@/lib/gap-analysis/dimensions";

function inputStyle(): React.CSSProperties {
  return {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 13,
    color: "var(--text)",
    outline: "none",
  };
}

export default function WhatIfSimulator() {
  const [mode, setMode] = useState<"role" | "dimension">("role");
  const [role, setRole] = useState("");
  const [dimension, setDimension] = useState<CompetencyDimension>(COMPETENCY_DIMENSIONS[0]);
  const [delta, setDelta] = useState(15);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const outcome =
        mode === "role" ? await simulateTargetRoleChange(role) : await simulateDimensionImprovement(dimension, delta);
      if ("error" in outcome) setError(outcome.error);
      else setResult(outcome);
    });
  }

  const deltaColor = result ? (result.delta > 0 ? "var(--teal)" : result.delta < 0 ? "#f87171" : "var(--text-muted)") : "var(--text-muted)";

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>What if?</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
        Recalculated from your actual measured competencies — a projection, not a promise.
      </p>

      <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, padding: 3, marginBottom: 14, width: "fit-content" }}>
        {(["role", "dimension"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setResult(null);
              setError(null);
            }}
            style={{
              background: mode === m ? "var(--teal)" : "transparent",
              color: mode === m ? "#0A0F1E" : "var(--text-muted)",
              border: "none",
              borderRadius: 6,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {m === "role" ? "Change target role" : "Improve a skill"}
          </button>
        ))}
      </div>

      {mode === "role" ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Head of Product, People Manager, relocate to a Product role in the UAE…"
            style={{ ...inputStyle(), flex: 1, minWidth: 220 }}
          />
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
          <select value={dimension} onChange={(e) => setDimension(e.target.value as CompetencyDimension)} style={{ ...inputStyle(), cursor: "pointer" }}>
            {COMPETENCY_DIMENSIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>improve by</span>
          <input type="number" min={1} max={50} value={delta} onChange={(e) => setDelta(Number(e.target.value))} style={{ ...inputStyle(), width: 70 }} />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>points</span>
        </div>
      )}

      <button
        type="button"
        onClick={run}
        disabled={isPending || (mode === "role" && !role.trim())}
        style={{
          background: "var(--teal)",
          color: "#0A0F1E",
          border: "none",
          borderRadius: 8,
          padding: "9px 18px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          opacity: isPending || (mode === "role" && !role.trim()) ? 0.6 : 1,
        }}
      >
        {isPending ? "Simulating…" : "Simulate"}
      </button>

      {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 10 }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>{result.scenario}</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span className="mono" style={{ fontSize: 22, fontWeight: 800, color: "var(--text-muted)" }}>
              {result.currentReadiness}%
            </span>
            <span style={{ color: "var(--text-muted)" }}>→</span>
            <span className="mono" style={{ fontSize: 26, fontWeight: 800, color: deltaColor }}>
              {result.projectedReadiness}%
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: deltaColor }}>
              ({result.delta >= 0 ? "+" : ""}
              {result.delta} pts)
            </span>
          </div>
          {result.topGapsAfter.length > 0 && (
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 8 }}>
              Biggest remaining gaps after: {result.topGapsAfter.map((g) => g.dimension).join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
