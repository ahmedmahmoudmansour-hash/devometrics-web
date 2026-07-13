"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSuccessionRole, deleteSuccessionRole, generateSuccessionReport } from "@/lib/succession/actions";
import { ScoreBar, NineBoxGrid } from "@/components/dashboard/charts";
import type { SuccessionRole } from "@/lib/supabase/types";

// Same 3-bucket boundaries readinessColor() already uses for the pipeline
// counts and dot colors — reused here as a Y-axis position so the grid
// can't disagree with the badges sitting right next to it. Oriented so
// "ready now" plots highest: this is the honest way to show "who has more
// runway toward this role" from data we actually have (fit + a readiness
// bucket), without inventing a separate "potential" score the AI never
// produced.
function readinessToY(readiness: string): number {
  const r = readiness.toLowerCase();
  if (r.includes("ready now")) return 95;
  if (r.includes("month")) return 58;
  return 25;
}

const fieldStyle: React.CSSProperties = {
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

function readinessColor(readiness: string): string {
  const r = readiness.toLowerCase();
  if (r.includes("ready now")) return "var(--teal)";
  if (r.includes("month")) return "var(--amber)";
  return "var(--phase2)";
}

function RoleCard({ role, employeeCount }: { role: SuccessionRole; employeeCount: number }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await generateSuccessionReport(role.id);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteSuccessionRole(role.id);
      router.refresh();
    });
  }

  const report = role.report;
  const readyNow = report?.candidates.filter((c) => c.readiness.toLowerCase().includes("ready now")).length ?? 0;
  const nearReady = report?.candidates.filter((c) => c.readiness.toLowerCase().includes("month")).length ?? 0;
  const developing = report ? report.candidates.length - readyNow - nearReady : 0;

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{role.title}</h2>
          {role.description && (
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.6, maxWidth: 520 }}>
              {role.description}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={generate}
            disabled={isPending}
            style={{
              background: "rgba(0,201,167,0.1)",
              border: "1px solid rgba(0,201,167,0.3)",
              borderRadius: 8,
              padding: "7px 14px",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--teal)",
              cursor: "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? "Analyzing…" : report ? "↻ Re-run analysis" : "▶ Run AI analysis"}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={isPending}
            style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}
          >
            Delete
          </button>
        </div>
      </div>

      {error && <p style={{ color: "#f87171", fontSize: 12.5, marginTop: 10 }}>{error}</p>}

      {!report && !error && (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 12 }}>
          No analysis yet — run it to rank your {employeeCount} team member{employeeCount === 1 ? "" : "s"} against this role.
        </p>
      )}

      {report && (
        <div style={{ marginTop: 16 }}>
          {/* Bench strength pipeline */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--teal)", background: "rgba(0,201,167,0.1)", border: "1px solid rgba(0,201,167,0.3)", borderRadius: 999, padding: "4px 12px" }}>
              Ready now: {readyNow}
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--amber)", background: "rgba(240,184,64,0.08)", border: "1px solid rgba(240,184,64,0.3)", borderRadius: 999, padding: "4px 12px" }}>
              Near-ready: {nearReady}
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--phase2)", background: "rgba(125,211,252,0.08)", border: "1px solid rgba(125,211,252,0.3)", borderRadius: 999, padding: "4px 12px" }}>
              Developing: {developing}
            </span>
            {!report.hasStrongSuccessor && (
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 999, padding: "4px 12px" }}>
                ⚠ No strong successor
              </span>
            )}
          </div>

          {report.riskNote && (
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 14, borderLeft: "2px solid var(--amber)", paddingLeft: 10 }}>
              {report.riskNote}
            </p>
          )}

          {report.candidates.length > 0 && (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 14, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-muted)", alignSelf: "flex-start", marginBottom: 8 }}>
                Fit vs. readiness
              </p>
              <NineBoxGrid
                points={report.candidates.map((c) => ({ name: c.name, x: c.fitScore, y: readinessToY(c.readiness) }))}
                xLabel="Fit for this role"
                yLabel="Readiness"
                size={300}
              />
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {report.candidates.length === 0 && (
              <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                No plausible internal candidates identified for this role yet.
              </p>
            )}
            {report.candidates.map((c, i) => (
              <div key={c.userId} style={{ background: "rgba(255,255,255,0.03)", border: i === 0 ? "1px solid rgba(0,201,167,0.3)" : "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                    {i + 1}. {c.name}
                  </p>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: readinessColor(c.readiness), whiteSpace: "nowrap" }}>
                    {c.readiness}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 44px", alignItems: "center", gap: 10, marginTop: 8 }}>
                  <ScoreBar value={c.fitScore} color={readinessColor(c.readiness)} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: readinessColor(c.readiness) }}>{c.fitScore}</span>
                </div>
                <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 8 }}>{c.whyRanked}</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginTop: 10 }}>
                  {c.strengths.length > 0 && (
                    <div>
                      <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--teal)", marginBottom: 3 }}>Strengths</p>
                      {c.strengths.map((s) => (
                        <p key={s} style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.55 }}>+ {s}</p>
                      ))}
                    </div>
                  )}
                  {c.gaps.length > 0 && (
                    <div>
                      <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--amber)", marginBottom: 3 }}>Gaps</p>
                      {c.gaps.map((g) => (
                        <p key={g} style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.55 }}>− {g}</p>
                      ))}
                    </div>
                  )}
                </div>
                <p style={{ fontSize: 12, color: "var(--text)", marginTop: 10 }}>
                  <strong style={{ color: "var(--teal)" }}>Development focus:</strong> {c.developmentFocus}
                </p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10 }}>
            Generated {new Date(report.generatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} — re-run after new assessments or gap analyses.
          </p>
        </div>
      )}
    </div>
  );
}

export default function SuccessionBoard({ roles, employeeCount }: { roles: SuccessionRole[]; employeeCount: number }) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function create() {
    setError(null);
    startTransition(async () => {
      const result = await createSuccessionRole(title, description);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setTitle("");
      setDescription("");
      setCreating(false);
      router.refresh();
    });
  }

  const analyzed = roles.filter((r) => r.report);
  const needsAttention = analyzed.filter((r) => r.report && !r.report.hasStrongSuccessor);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, maxWidth: 640 }}>
        Define the roles whose sudden vacancy would hurt most, then run AI analysis on each — it ranks
        your current team against that specific role using their real measured competency data, so the
        conversation starts from evidence instead of guesswork.
      </p>

      {roles.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", borderRadius: 999, padding: "5px 14px" }}>
            {roles.length} critical role{roles.length === 1 ? "" : "s"} defined
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", borderRadius: 999, padding: "5px 14px" }}>
            {analyzed.length} analyzed
          </span>
          {needsAttention.length > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 999, padding: "5px 14px" }}>
              ⚠ {needsAttention.length} need{needsAttention.length === 1 ? "s" : ""} attention — no strong successor
            </span>
          )}
        </div>
      )}

      {creating ? (
        <div style={{ background: "var(--navy-mid)", border: "1px solid rgba(0,201,167,0.3)", borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Critical role title — e.g. Head of Operations"
            aria-label="Role title"
            style={fieldStyle}
            autoFocus
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does success in this role require? Key responsibilities, competencies, scope… (the more specific, the better the ranking)"
            aria-label="Role requirements"
            rows={4}
            style={{ ...fieldStyle, resize: "vertical" }}
          />
          {error && <p style={{ color: "#f87171", fontSize: 12.5 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={create}
              disabled={isPending}
              style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
            >
              {isPending ? "Creating…" : "Create role"}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", alignSelf: "flex-start" }}
        >
          + Define a critical role
        </button>
      )}

      {roles.length === 0 && !creating && (
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
            Start with the role whose sudden vacancy would hurt most. The AI ranks your current
            people against it using their measured competency data — fit, readiness, gaps, and what
            to develop — so the succession conversation starts from evidence.
          </p>
        </div>
      )}

      {roles.map((role) => (
        <RoleCard key={role.id} role={role} employeeCount={employeeCount} />
      ))}

      <details style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px" }}>
        <summary style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", cursor: "pointer" }}>
          Methodology &amp; responsible use
        </summary>
        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7, marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <p>
            Rankings are grounded exclusively in each person&apos;s measured competency data on this
            platform (gap analyses, assessments) — following the selection-science principle that
            structured, multi-source evidence outperforms unstructured judgment (the meta-analytic
            tradition of Schmidt &amp; Hunter, 1998). The AI never considers age, gender,
            nationality, or anything beyond the competency evidence.
          </p>
          <p>
            This is decision support, not a decision. Fit scores reflect data quality: someone who
            hasn&apos;t run a Gap Analysis can&apos;t rank well, which is a data gap, not a verdict on
            them — the risk note flags this. Use the ranking to structure a human succession
            conversation, alongside performance history and context this platform doesn&apos;t
            capture.
          </p>
        </div>
      </details>
    </div>
  );
}
