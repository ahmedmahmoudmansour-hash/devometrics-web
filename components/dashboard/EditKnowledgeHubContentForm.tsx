"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateKnowledgeHubContent, archiveKnowledgeHubContent } from "@/lib/knowledgeHub/actions";
import type { KnowledgeHubContent } from "@/lib/supabase/types";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
};

export default function EditKnowledgeHubContentForm({ content }: { content: KnowledgeHubContent }) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(content.title);
  const [description, setDescription] = useState(content.description ?? "");
  const [passingScore, setPassingScore] = useState(content.passing_score_percent);
  const [dueDate, setDueDate] = useState(content.due_date ?? "");
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateKnowledgeHubContent(content.id, {
        title,
        description,
        passingScorePercent: passingScore,
        dueDate: dueDate || null,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setExpanded(false);
      router.refresh();
    });
  }

  function archive() {
    setError(null);
    startTransition(async () => {
      const result = await archiveKnowledgeHubContent(content.id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push("/dashboard/company/knowledge-hub");
    });
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "8px 16px",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text)",
          cursor: "pointer",
        }}
      >
        Edit
      </button>
    );
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480 }}>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={inputStyle} />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
        <div style={{ display: "flex", gap: 12 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 6 }}>
            Due date
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ ...inputStyle, colorScheme: "dark" }}
            />
          </label>
          {content.completion_type === "exam" && (
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 6 }}>
              Passing score (%)
              <input
                type="number"
                min={1}
                max={100}
                value={passingScore}
                onChange={(e) => setPassingScore(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
                style={inputStyle}
              />
            </label>
          )}
        </div>

        {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          {confirmingArchive ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Archive this content?</span>
              <button
                type="button"
                onClick={archive}
                disabled={isPending}
                style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.4)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: "#f87171", cursor: "pointer" }}
              >
                {isPending ? "Archiving…" : "Yes, archive"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingArchive(false)}
                style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingArchive(true)}
              style={{ background: "transparent", border: "1px solid rgba(248,113,113,0.4)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "#f87171", cursor: "pointer" }}
            >
              Archive this content
            </button>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              disabled={isPending}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
            >
              {isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Archiving hides this from active lists but keeps everyone&apos;s completion history intact —
          it doesn&apos;t delete anything.
        </p>
      </div>
    </div>
  );
}
