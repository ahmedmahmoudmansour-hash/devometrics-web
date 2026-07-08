"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { breakdownMilestoneIntoTasks } from "@/lib/tasks/actions";
import type { Milestone } from "@/lib/supabase/types";

function MilestoneRow({ milestone }: { milestone: Milestone }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  function handleBreakdown() {
    setMessage(null);
    startTransition(async () => {
      const result = await breakdownMilestoneIntoTasks(milestone.id);
      if (result?.error) {
        setMessage(result.error);
        return;
      }
      setMessage(`Added ${result?.count ?? 0} tasks to today.`);
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 13, color: "var(--text)" }}>{milestone.title}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {message && <span style={{ fontSize: 11, color: message.includes("Added") ? "var(--teal)" : "#f87171" }}>{message}</span>}
        <button
          type="button"
          onClick={handleBreakdown}
          disabled={isPending}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 12,
            color: "var(--teal)",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {isPending ? "Thinking…" : "Break into daily tasks"}
        </button>
      </div>
    </div>
  );
}

export default function MilestoneBreakdownList({ milestones }: { milestones: Milestone[] }) {
  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Your open milestones</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>
        Turn any of these into a few concrete steps for today.
      </p>
      <div>
        {milestones.map((m) => (
          <MilestoneRow key={m.id} milestone={m} />
        ))}
      </div>
    </div>
  );
}
