"use client";

import { useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { resetGrowMemory } from "@/lib/coach/actions";
import type { CoachGrowMemory } from "@/lib/supabase/types";

const ROW: React.CSSProperties = { fontSize: 12, lineHeight: 1.5, marginBottom: 8 };
const LABEL: React.CSSProperties = { color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", fontSize: 10, letterSpacing: "0.04em" };

// Splits a "will" summary into distinct commitments so they read as a
// checklist instead of one dense paragraph — coach replies naturally
// separate commitments with periods or semicolons ("Update the resume by
// Friday; practice the STAR method twice a week").
function splitCommitments(will: string): string[] {
  return will
    .split(/(?<=[.;])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function CoachMemoryCard({ memory }: { memory: CoachGrowMemory | null }) {
  const [isPending, startTransition] = useTransition();

  if (!memory || !(memory.goal || memory.reality || memory.options || memory.will)) return null;

  const commitments = memory.will ? splitCommitments(memory.will) : [];

  return (
    <div style={{ marginBottom: 16 }}>
      {commitments.length > 0 && (
        <div
          style={{
            background: "rgba(0,201,167,0.06)",
            border: "1px solid rgba(0,201,167,0.3)",
            borderRadius: 16,
            padding: 20,
            marginBottom: 12,
          }}
        >
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--teal)", marginBottom: 10 }}>
            Your action plan — agreed with your coach
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {commitments.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <CheckCircle2 size={15} color="var(--teal)" style={{ marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(memory.goal || memory.reality || memory.options) && (
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Coaching context so far</h2>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(() => {
                  resetGrowMemory();
                })
              }
              style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer" }}
            >
              Reset
            </button>
          </div>
          {memory.goal && (
            <p style={ROW}>
              <span style={LABEL}>Goal </span>
              <span style={{ color: "var(--text)" }}>{memory.goal}</span>
            </p>
          )}
          {memory.reality && (
            <p style={ROW}>
              <span style={LABEL}>Reality </span>
              <span style={{ color: "var(--text)" }}>{memory.reality}</span>
            </p>
          )}
          {memory.options && (
            <p style={{ ...ROW, marginBottom: 0 }}>
              <span style={LABEL}>Options </span>
              <span style={{ color: "var(--text)" }}>{memory.options}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
