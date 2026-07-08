"use client";

import { useState, useTransition } from "react";
import { toggleMilestone, updateMilestone, deleteMilestone } from "@/app/dashboard/actions";
import CourseRecommendations from "@/components/dashboard/CourseRecommendations";
import type { Milestone } from "@/lib/supabase/types";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 13,
  color: "var(--text)",
  outline: "none",
};

export default function MilestoneRow({ milestone }: { milestone: Milestone }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(milestone.title);
  const [description, setDescription] = useState(milestone.description ?? "");
  const [targetDate, setTargetDate] = useState(milestone.target_date ?? "");
  const [userNotes, setUserNotes] = useState(milestone.user_notes ?? "");

  const meta = [
    milestone.target_date ? `by ${milestone.target_date}` : null,
    milestone.weekly_hours ? `~${milestone.weekly_hours} hrs/${milestone.hours_period ?? "month"}` : null,
    milestone.budget_note,
  ].filter(Boolean);

  if (editing) {
    return (
      <div style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 30 }}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Milestone title"
            style={inputStyle}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-label="Milestone description"
            rows={2}
            style={{ ...inputStyle, resize: "vertical" }}
          />
          <input
            type="date"
            lang="en-US"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            aria-label="Target date"
            style={{ ...inputStyle, colorScheme: "dark" }}
          />
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              Your own notes (private, just for you)
            </label>
            <textarea
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              aria-label="Your personal notes"
              placeholder="e.g. reminder of who to ask, a link, or why this matters to you"
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
          {error && <p style={{ color: "#f87171", fontSize: 12 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await updateMilestone(milestone.id, {
                    title,
                    description: description || null,
                    target_date: targetDate || null,
                    user_notes: userNotes || null,
                  });
                  if (result?.error) setError(result.error);
                  else setEditing(false);
                })
              }
              style={{
                background: "var(--teal)",
                color: "#0A0F1E",
                border: "none",
                borderRadius: 6,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setTitle(milestone.title);
                setDescription(milestone.description ?? "");
                setTargetDate(milestone.target_date ?? "");
                setUserNotes(milestone.user_notes ?? "");
                setError(null);
                setEditing(false);
              }}
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "6px 14px",
                fontSize: 12,
                color: "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <input
          type="checkbox"
          checked={milestone.completed}
          onChange={() =>
            startTransition(async () => {
              const result = await toggleMilestone(milestone.id, !milestone.completed);
              setError(result?.error ?? null);
            })
          }
          style={{ width: 18, height: 18, marginTop: 2, accentColor: "var(--teal)", flexShrink: 0, cursor: "pointer" }}
        />
        <div style={{ flex: 1, opacity: isPending ? 0.5 : 1 }}>
          <span
            style={{
              fontSize: 14,
              color: milestone.completed ? "var(--text-muted)" : "var(--text)",
              textDecoration: milestone.completed ? "line-through" : "none",
            }}
          >
            {milestone.title}
          </span>
          {milestone.assigned_by && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 10,
                fontWeight: 700,
                color: "var(--amber)",
                background: "rgba(240,184,64,0.1)",
                border: "1px solid rgba(240,184,64,0.3)",
                borderRadius: 999,
                padding: "2px 8px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Assigned by your manager
            </span>
          )}
          {milestone.description && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.5 }}>
              {milestone.description}
            </div>
          )}
          {meta.length > 0 && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
              {meta.join(" · ")}
            </div>
          )}
          {milestone.success_indicator && (
            <div style={{ fontSize: 11, color: "var(--teal)", marginTop: 3, lineHeight: 1.5 }}>
              Success: {milestone.success_indicator}
            </div>
          )}
          {!milestone.completed && <CourseRecommendations topic={milestone.title} />}
          {milestone.user_notes && (
            <div
              style={{
                fontSize: 12,
                color: "var(--text)",
                marginTop: 6,
                lineHeight: 1.5,
                background: "rgba(240,184,64,0.08)",
                border: "1px solid rgba(240,184,64,0.25)",
                borderRadius: 6,
                padding: "6px 10px",
              }}
            >
              <span style={{ color: "var(--amber)", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Your note
              </span>
              <div style={{ marginTop: 2, whiteSpace: "pre-wrap" }}>{milestone.user_notes}</div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {milestone.target_date && (
            <a
              href={`/api/calendar/milestone/${milestone.id}`}
              aria-label="Add to calendar"
              style={{ color: "var(--text-muted)", fontSize: 12, padding: 4, textDecoration: "none" }}
            >
              Add to calendar
            </a>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Edit milestone"
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", padding: 4 }}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                const result = await deleteMilestone(milestone.id);
                setError(result?.error ?? null);
              })
            }
            aria-label="Delete milestone"
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", padding: 4 }}
          >
            Delete
          </button>
        </div>
      </div>
      {error && <p style={{ color: "#f87171", fontSize: 12, margin: "4px 0 0 30px" }}>{error}</p>}
    </div>
  );
}
