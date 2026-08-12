"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { setMilestoneStatus, updateMilestone, deleteMilestone, type MilestoneStatus } from "@/app/dashboard/actions";
import CourseRecommendations from "@/components/dashboard/CourseRecommendations";
import type { Milestone } from "@/lib/supabase/types";

const STATUS_COLOR: Record<MilestoneStatus, string> = {
  not_started: "var(--text-muted)",
  in_progress: "var(--phase2)",
  completed: "var(--teal)",
  deferred: "var(--amber)",
};

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
  const t = useTranslations("milestoneRow");
  const STATUS_LABEL: Record<MilestoneStatus, string> = {
    not_started: t("statusNotStarted"),
    in_progress: t("statusInProgress"),
    completed: t("statusCompleted"),
    deferred: t("statusDeferred"),
  };
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(milestone.title);
  const [description, setDescription] = useState(milestone.description ?? "");
  // Falls back to "in_progress" if the migration adding this column hasn't
  // been run yet on this database — degrades gracefully rather than
  // rendering a blank status, same pattern used elsewhere in this app for
  // not-yet-migrated columns.
  const status: MilestoneStatus = milestone.status ?? "in_progress";
  const [targetDate, setTargetDate] = useState(milestone.target_date ?? "");
  const [userNotes, setUserNotes] = useState(milestone.user_notes ?? "");

  const meta = [
    milestone.target_date ? t("byDate", { date: milestone.target_date }) : null,
    milestone.weekly_hours ? t("hoursPerPeriod", { hours: milestone.weekly_hours, period: milestone.hours_period ?? t("monthFallback") }) : null,
    milestone.budget_note,
  ].filter(Boolean);

  if (editing) {
    return (
      <div style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingInlineStart: 30 }}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label={t("milestoneTitleAria")}
            style={inputStyle}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-label={t("milestoneDescriptionAria")}
            rows={2}
            style={{ ...inputStyle, resize: "vertical" }}
          />
          <input
            type="date"
            lang="en-US"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            aria-label={t("targetDateAria")}
            style={{ ...inputStyle, colorScheme: "dark" }}
          />
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              {t("ownNotesLabel")}
            </label>
            <textarea
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              aria-label={t("personalNotesAria")}
              placeholder={t("notesPlaceholder")}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
          {error && <p style={{ color: "var(--danger)", fontSize: 12 }}>{error}</p>}
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
              {t("save")}
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
              {t("cancel")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <select
          aria-label={t("statusForAria", { title: milestone.title })}
          value={status}
          onChange={(e) =>
            startTransition(async () => {
              const result = await setMilestoneStatus(milestone.id, e.target.value as MilestoneStatus);
              setError(result?.error ?? null);
            })
          }
          style={{
            marginTop: 1,
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 700,
            padding: "4px 8px",
            borderRadius: 6,
            cursor: "pointer",
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${STATUS_COLOR[status]}`,
            color: STATUS_COLOR[status],
          }}
        >
          {(Object.keys(STATUS_LABEL) as MilestoneStatus[]).map((s) => (
            <option key={s} value={s} style={{ color: "#0A0F1E" }}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <div style={{ flex: 1, opacity: isPending ? 0.5 : 1 }}>
          <span
            style={{
              fontSize: 14,
              color: status === "completed" ? "var(--text-muted)" : "var(--text)",
              textDecoration: status === "completed" ? "line-through" : "none",
            }}
          >
            {milestone.title}
          </span>
          {milestone.assigned_by && (
            <span
              style={{
                marginInlineStart: 8,
                fontSize: 10,
                fontWeight: 700,
                color: "var(--amber)",
                background: "rgba(var(--amber-rgb),0.1)",
                border: "1px solid rgba(var(--amber-rgb),0.3)",
                borderRadius: 999,
                padding: "2px 8px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {t("assignedByManager")}
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
              {t("successPrefix", { indicator: milestone.success_indicator })}
            </div>
          )}
          {status !== "completed" && <CourseRecommendations topic={milestone.title} />}
          {milestone.user_notes && (
            <div
              style={{
                fontSize: 12,
                color: "var(--text)",
                marginTop: 6,
                lineHeight: 1.5,
                background: "rgba(var(--amber-rgb),0.08)",
                border: "1px solid rgba(var(--amber-rgb),0.25)",
                borderRadius: 6,
                padding: "6px 10px",
              }}
            >
              <span style={{ color: "var(--amber)", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {t("yourNoteLabel")}
              </span>
              <div style={{ marginTop: 2, whiteSpace: "pre-wrap" }}>{milestone.user_notes}</div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {milestone.target_date && (
            <a
              href={`/api/calendar/milestone/${milestone.id}`}
              aria-label={t("addToCalendar")}
              style={{ color: "var(--text-muted)", fontSize: 12, padding: 4, textDecoration: "none" }}
            >
              {t("addToCalendar")}
            </a>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={t("editMilestoneAria")}
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", padding: 4 }}
          >
            {t("edit")}
          </button>
          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                const result = await deleteMilestone(milestone.id);
                setError(result?.error ?? null);
              })
            }
            aria-label={t("deleteMilestoneAria")}
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", padding: 4 }}
          >
            {t("delete")}
          </button>
        </div>
      </div>
      {error && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 4, marginInlineStart: 30 }}>{error}</p>}
    </div>
  );
}
