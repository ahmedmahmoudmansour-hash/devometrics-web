"use client";

import { useState } from "react";
import { getKnowledgeHubEmployeeAttempts, type KnowledgeHubAttempt } from "@/lib/knowledgeHub/actions";

export default function KnowledgeHubAttemptHistory({
  contentId,
  employeeUserId,
  attemptCount,
}: {
  contentId: string;
  employeeUserId: string;
  attemptCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState<KnowledgeHubAttempt[] | null>(null);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (attempts === null) {
      setLoading(true);
      const result = await getKnowledgeHubEmployeeAttempts(contentId, employeeUserId);
      setAttempts(result);
      setLoading(false);
    }
  }

  if (attemptCount === 0) return null;

  return (
    <div style={{ marginTop: 4 }}>
      <button
        type="button"
        onClick={toggle}
        style={{ background: "none", border: "none", color: "var(--teal)", fontSize: 11.5, cursor: "pointer", padding: 0 }}
      >
        {open ? "Hide history" : `History (${attemptCount})`}
      </button>
      {open && (
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
          {loading ? (
            <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Loading…</p>
          ) : (
            (attempts ?? []).map((a) => (
              <div key={a.id} style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", gap: 8 }}>
                <span>{new Date(a.completedAt).toLocaleString()}</span>
                {a.scorePercent !== null && (
                  <span style={{ color: a.passed ? "var(--teal)" : "#f87171", fontWeight: 700 }}>
                    {a.scorePercent}% {a.passed ? "· passed" : "· failed"}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
