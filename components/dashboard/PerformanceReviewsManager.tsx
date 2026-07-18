"use client";

import { useState, useTransition } from "react";
import { createReviewCycle, updateCycleStatus, listReviewCycles, listReviewsForCycle } from "@/lib/performanceReviews/actions";
import ImpactCycleReviewRow from "@/components/dashboard/ImpactCycleReviewRow";
import type { PerformanceReviewCycle, ReviewListItem } from "@/lib/performanceReviews/types";

const CYCLE_STATUS_COLOR: Record<string, string> = {
  draft: "148,163,184",
  open: "0,201,167",
  closed: "148,163,184",
};

function inputStyle(): React.CSSProperties {
  return {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 13,
    color: "var(--text)",
    outline: "none",
    width: "100%",
  };
}

function CreateCycleForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createReviewCycle(name, opensAt, closesAt);
      if (result?.error) setError(result.error);
      else {
        setName("");
        setOpensAt("");
        setClosesAt("");
        setOpen(false);
        onCreated();
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ background: "rgba(0,201,167,0.1)", border: "1px solid rgba(0,201,167,0.3)", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "var(--teal)", cursor: "pointer" }}
      >
        + New Impact Cycle
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, display: "block" }}>Cycle name *</label>
        <input style={inputStyle()} value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="H1 2026" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, display: "block" }}>Opens</label>
          <input type="date" style={inputStyle()} value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, display: "block" }}>Closes</label>
          <input type="date" style={inputStyle()} value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
        </div>
      </div>
      {error && <p style={{ color: "#f87171", fontSize: 12 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={isPending} style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}>
          {isPending ? "Creating…" : "Create"}
        </button>
        <button type="button" onClick={() => setOpen(false)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function PerformanceReviewsManager({ initialCycles }: { initialCycles: PerformanceReviewCycle[] }) {
  const [cycles, setCycles] = useState(initialCycles);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(initialCycles[0]?.id ?? null);
  const [reviews, setReviews] = useState<ReviewListItem[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [, startTransition] = useTransition();

  async function loadReviews(cycleId: string) {
    setLoadingReviews(true);
    const items = await listReviewsForCycle(cycleId);
    setReviews(items);
    setLoadingReviews(false);
  }

  function selectCycle(cycleId: string) {
    setSelectedCycleId(cycleId);
    loadReviews(cycleId);
  }

  function refreshCycles() {
    startTransition(async () => {
      const { cycles: next } = await listReviewCycles();
      setCycles(next);
      if (next[0] && !selectedCycleId) selectCycle(next[0].id);
    });
  }

  const selectedCycle = cycles.find((c) => c.id === selectedCycleId) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <CreateCycleForm onCreated={refreshCycles} />
      </div>

      {cycles.length === 0 ? (
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No Impact Cycles yet — create one above to start collecting Reflections and Manager&apos;s Perspectives.</p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {cycles.map((c) => {
              const color = CYCLE_STATUS_COLOR[c.status];
              const active = c.id === selectedCycleId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectCycle(c.id)}
                  style={{
                    background: active ? `rgba(${color},0.14)` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${active ? `rgba(${color},0.4)` : "var(--border)"}`,
                    borderRadius: 10,
                    padding: "8px 14px",
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: active ? `rgb(${color})` : "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  {c.name} · {c.status}
                </button>
              );
            })}
          </div>

          {selectedCycle && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Cycle status:</span>
              {(["draft", "open", "closed"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={selectedCycle.status === s}
                  onClick={() =>
                    startTransition(async () => {
                      await updateCycleStatus(selectedCycle.id, s);
                      refreshCycles();
                    })
                  }
                  style={{
                    background: "none",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 11,
                    color: selectedCycle.status === s ? "var(--teal)" : "var(--text-muted)",
                    fontWeight: selectedCycle.status === s ? 700 : 500,
                    cursor: selectedCycle.status === s ? "default" : "pointer",
                    opacity: selectedCycle.status === s ? 1 : 0.7,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {loadingReviews ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading…</p>
          ) : reviews.length === 0 ? (
            <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No employees in this cycle yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {reviews.map((item) => (
                <ImpactCycleReviewRow key={item.id} item={item} onChanged={() => selectedCycleId && loadReviews(selectedCycleId)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
