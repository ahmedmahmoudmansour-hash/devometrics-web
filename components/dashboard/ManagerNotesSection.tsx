"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addManagerNote, deleteManagerNote } from "@/lib/organizations/actions";
import type { ManagerNote } from "@/lib/supabase/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// A running log of admin/manager notes on an employee — optional, never
// AI-generated, visible only to org admins (never the employee themselves,
// same RLS boundary as every other admin-only HR field). Feeds into the
// succession ranking and assessment summary prompts as qualitative context
// when present, but nothing requires it to exist.
export default function ManagerNotesSection({
  employeeUserId,
  notes,
  employeeName,
}: {
  employeeUserId: string;
  notes: ManagerNote[];
  employeeName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");

  const card: React.CSSProperties = {
    background: "var(--navy-mid)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 24,
  };

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await addManagerNote(employeeUserId, text);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setText("");
      router.refresh();
    });
  }

  return (
    <div className="no-print" style={card}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
        Manager notes
      </h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>
        Optional, qualitative notes about {employeeName.split(" ")[0]} for you and other admins —
        visible only here, never AI-generated, never shown to the employee. Used as additional
        context in AI reports and succession rankings when present.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a note…"
          rows={3}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 13,
            color: "var(--text)",
            outline: "none",
            resize: "vertical",
          }}
        />
        <button
          type="button"
          disabled={isPending || !text.trim()}
          onClick={submit}
          style={{
            alignSelf: "flex-start",
            background: "var(--teal)",
            color: "#0A0F1E",
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 700,
            cursor: text.trim() ? "pointer" : "not-allowed",
            opacity: isPending || !text.trim() ? 0.5 : 1,
          }}
        >
          {isPending ? "Saving…" : "Add note"}
        </button>
        {error && <p style={{ color: "#f87171", fontSize: 12 }}>{error}</p>}
      </div>

      {notes.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>No notes yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {notes.map((n) => (
            <div key={n.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, background: "rgba(255,255,255,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text)" }}>{n.authorName}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatDate(n.created_at)}</span>
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        await deleteManagerNote(n.id, employeeUserId);
                        router.refresh();
                      })
                    }
                    style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{n.note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
