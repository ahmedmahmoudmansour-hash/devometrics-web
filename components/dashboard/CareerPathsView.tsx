"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateCareerPaths } from "@/lib/career-paths/actions";
import type { CareerPathNode, CareerPaths } from "@/lib/supabase/types";

function readinessColor(percent: number): string {
  if (percent >= 75) return "var(--teal)";
  if (percent >= 45) return "var(--amber)";
  return "var(--phase2)";
}

function NodeCard({ node, isFirst }: { node: CareerPathNode; isFirst: boolean }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: isFirst ? "1px solid rgba(0,201,167,0.3)" : "1px solid var(--border)",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{node.role}</h3>
        <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{node.estimatedTime}</span>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
          <span>Readiness today</span>
          <span style={{ color: readinessColor(node.readinessPercent), fontWeight: 700 }}>{node.readinessPercent}%</span>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
          <div
            style={{
              width: `${Math.max(0, Math.min(100, node.readinessPercent))}%`,
              height: "100%",
              background: readinessColor(node.readinessPercent),
              borderRadius: 3,
            }}
          />
        </div>
      </div>

      <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 10 }}>{node.whyThisPath}</p>

      {node.requiredSkills.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {node.requiredSkills.map((s) => (
            <span
              key={s}
              style={{
                fontSize: 11,
                color: "var(--text)",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid var(--border)",
                borderRadius: 999,
                padding: "3px 10px",
              }}
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {node.gaps.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "var(--amber)", textTransform: "uppercase", marginBottom: 4 }}>
            Your gaps for this role
          </p>
          {node.gaps.map((g) => (
            <p key={g} style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
              — {g}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CareerPathsView({ saved }: { saved: CareerPaths | null }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await generateCareerPaths();
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  if (!saved) {
    return (
      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, textAlign: "center" }}>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, maxWidth: 480, margin: "0 auto" }}>
          Your map hasn&apos;t been generated yet. It works best after you&apos;ve run a Gap Analysis
          and filled in your career profile — the more real signal, the more honest the map.
        </p>
        <button
          type="button"
          onClick={generate}
          disabled={isPending}
          style={{
            marginTop: 20,
            background: "var(--teal)",
            color: "#0A0F1E",
            border: "none",
            borderRadius: 10,
            padding: "12px 24px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? "Mapping your paths…" : "🗺 Generate my career map"}
        </button>
        {error && <p style={{ color: "#f87171", fontSize: 13, marginTop: 12 }}>{error}</p>}
      </div>
    );
  }

  const { currentRole, branches } = saved.paths;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div
          style={{
            background: "rgba(0,201,167,0.08)",
            border: "1px solid rgba(0,201,167,0.3)",
            borderRadius: 12,
            padding: "10px 18px",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--teal)", textTransform: "uppercase" }}>
            You are here
          </span>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginTop: 2 }}>{currentRole}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <button
            type="button"
            onClick={generate}
            disabled={isPending}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-muted)",
              cursor: "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? "Regenerating…" : "↻ Regenerate"}
          </button>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            Generated {new Date(saved.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        </div>
      </div>
      {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 16 }}>
        {branches.map((branch) => (
          <div
            key={branch.name}
            style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}
          >
            <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", color: "var(--teal)", textTransform: "uppercase" }}>
              {branch.name}
            </h2>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 6, marginBottom: 14 }}>
              {branch.description}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {branch.nodes.map((node, i) => (
                <div key={node.role}>
                  {i > 0 && (
                    <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
                      <span style={{ color: "var(--text-muted)", fontSize: 14 }}>↓</span>
                    </div>
                  )}
                  <NodeCard node={node} isFirst={i === 0} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
        AI-generated from your own data — a starting point for a career conversation, not a
        guarantee or a prescription. Readiness reflects your latest Gap Analysis; re-run it as you
        grow and regenerate the map.
      </p>
    </div>
  );
}
