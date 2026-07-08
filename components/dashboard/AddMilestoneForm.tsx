"use client";

import { useRef, useState, useTransition } from "react";
import { createMilestone } from "@/app/dashboard/actions";

export default function AddMilestoneForm({
  planId,
  nextPosition,
}: {
  planId: string;
  nextPosition: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const title = inputRef.current?.value.trim();
        if (!title) return;
        startTransition(async () => {
          const result = await createMilestone(planId, title, nextPosition);
          setError(result?.error ?? null);
          if (!result?.error && inputRef.current) inputRef.current.value = "";
        });
      }}
      style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 16 }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        <input
          ref={inputRef}
          type="text"
          aria-label="New milestone title"
          placeholder="Add a milestone…"
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 14,
            color: "var(--text)",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={isPending}
          style={{
            background: "rgba(0,201,167,0.1)",
            border: "1px solid rgba(0,201,167,0.3)",
            borderRadius: 8,
            padding: "10px 16px",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--teal)",
            cursor: "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          Add
        </button>
      </div>
      {error && <p style={{ color: "#f87171", fontSize: 12 }}>{error}</p>}
    </form>
  );
}
