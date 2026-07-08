"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createTask,
  toggleTask,
  toggleSubtask,
  deleteTask,
  breakdownTaskIntoSubtasks,
  updateTaskNotes,
  updateTaskMeta,
} from "@/lib/tasks/actions";
import { TASK_CATEGORIES, categoryLabel, type PersonalTask, type TaskRecurring, type TaskPriority } from "@/lib/tasks/types";
import type { Milestone } from "@/lib/supabase/types";

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  high: "#f87171",
  medium: "#f0b840",
  low: "var(--text-muted)",
};

const PRIORITY_ORDER: TaskPriority[] = ["low", "medium", "high"];

function defaultDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// Displays a stored 24-hour "HH:MM" as a friendly 12-hour time, always in
// English regardless of the browser/OS locale — this is plain string math,
// not a locale-sensitive Intl call, so it can't render in Arabic numerals.
function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function googleRecurRule(recurring: TaskRecurring): string | null {
  if (recurring === "daily") return "RRULE:FREQ=DAILY";
  if (recurring === "weekdays") return "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
  if (recurring === "weekly") return "RRULE:FREQ=WEEKLY";
  if (recurring === "monthly") return "RRULE:FREQ=MONTHLY";
  return null;
}

function toGoogleDateStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

// Three ways to get a task onto an outside calendar, in increasing order of
// setup cost: Google/Outlook one-click deep links (no auth, no OAuth, this
// tab does all the work) for a quick single add, and .ics download for
// recurring tasks or other calendar apps (Apple, etc.). A true live-syncing
// integration (auto-updating as the task changes) would need a real OAuth
// app (Google Cloud / Azure App Registration) — a separate, much bigger
// project than "get this on my calendar," and reminders are already handled
// for free once an event exists, since every calendar app has its own
// built-in notification system.
function AddToCalendarControl({
  taskId,
  title,
  recurring,
  taskDate,
  taskTime,
}: {
  taskId: string;
  title: string;
  recurring: TaskRecurring;
  taskDate: string;
  taskTime: string | null;
}) {
  const [open, setOpen] = useState(false);
  // Pre-fills from the task's own date/time when it has one set, instead of
  // always defaulting to today at 9am — one less thing to re-enter for a
  // task that already has a real scheduled time.
  const [date, setDate] = useState(taskDate || defaultDate());
  const [time, setTime] = useState(taskTime || "09:00");

  const startAt = useMemo(() => {
    const [y, m, d] = date.split("-").map(Number);
    const [h, min] = time.split(":").map(Number);
    if (!y || !m || !d || Number.isNaN(h) || Number.isNaN(min)) return null;
    return new Date(y, m - 1, d, h, min);
  }, [date, time]);

  const icsHref = startAt ? `/api/calendar/task/${taskId}?start=${encodeURIComponent(startAt.toISOString())}` : undefined;

  const googleHref = useMemo(() => {
    if (!startAt) return undefined;
    const end = new Date(startAt.getTime() + 30 * 60 * 1000);
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: title,
      dates: `${toGoogleDateStamp(startAt)}/${toGoogleDateStamp(end)}`,
      details: "From your Devometrics daily tasks — private to you.",
    });
    const recur = googleRecurRule(recurring);
    if (recur) params.set("recur", recur);
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }, [startAt, title, recurring]);

  const outlookHref = useMemo(() => {
    if (!startAt) return undefined;
    const end = new Date(startAt.getTime() + 30 * 60 * 1000);
    const params = new URLSearchParams({
      path: "/calendar/action/compose",
      rru: "addevent",
      subject: title,
      startdt: startAt.toISOString(),
      enddt: end.toISOString(),
    });
    return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
  }, [startAt, title]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11.5, cursor: "pointer", padding: 0 }}
      >
        Add to calendar
      </button>
    );
  }

  const linkStyle: React.CSSProperties = {
    background: "rgba(0,201,167,0.1)",
    border: "1px solid rgba(0,201,167,0.3)",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 700,
    color: "var(--teal)",
    textDecoration: "none",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <input
        type="date"
        lang="en-US"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        aria-label="Calendar date"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "var(--text)", colorScheme: "dark" }}
      />
      <input
        type="time"
        lang="en-US"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        aria-label="Calendar time"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "var(--text)", colorScheme: "dark" }}
      />
      <a href={googleHref} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, opacity: googleHref ? 1 : 0.5, pointerEvents: googleHref ? "auto" : "none" }}>
        Google
      </a>
      <a href={outlookHref} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, opacity: outlookHref ? 1 : 0.5, pointerEvents: outlookHref ? "auto" : "none" }}>
        Outlook
      </a>
      <a href={icsHref} style={{ ...linkStyle, opacity: icsHref ? 1 : 0.5, pointerEvents: icsHref ? "auto" : "none" }}>
        .ics
      </a>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13,
  color: "var(--text)",
  outline: "none",
};

function NotesControl({ taskId, initialNotes }: { taskId: string; initialNotes: string | null }) {
  const [open, setOpen] = useState(Boolean(initialNotes));
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSave() {
    startTransition(async () => {
      await updateTaskNotes(taskId, notes);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11.5, cursor: "pointer", padding: 0 }}
      >
        Add note
      </button>
    );
  }

  return (
    <div style={{ marginTop: 8, width: "100%" }}>
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setSaved(false);
        }}
        onBlur={handleSave}
        placeholder="Notes for tracking your own progress"
        rows={2}
        style={{ ...inputStyle, width: "100%", resize: "vertical" }}
      />
      {isPending ? (
        <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>Saving…</p>
      ) : saved ? (
        <p style={{ fontSize: 10.5, color: "var(--teal)", marginTop: 2 }}>Saved</p>
      ) : null}
    </div>
  );
}

function IconPicker({ taskId, currentIcon }: { taskId: string; currentIcon: string | null }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const currentLabel = categoryLabel(currentIcon);

  function pick(icon: string) {
    startTransition(async () => {
      await updateTaskMeta(taskId, { icon });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={isPending}
        title={currentLabel ?? "Choose a category"}
        aria-label={currentLabel ?? "Choose a category"}
        style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, width: 26, height: 26, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
      >
        {currentIcon ?? "+"}
      </button>
      {currentLabel && <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{currentLabel}</span>}
      {open && (
        <div
          style={{
            position: "absolute",
            top: 30,
            left: 0,
            zIndex: 10,
            background: "var(--navy-mid)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 6,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            minWidth: 170,
          }}
        >
          {TASK_CATEGORIES.map((c) => (
            <button
              key={c.icon}
              type="button"
              onClick={() => pick(c.icon)}
              style={{ background: "none", border: "none", fontSize: 12.5, color: "var(--text)", cursor: "pointer", padding: "5px 8px", display: "flex", alignItems: "center", gap: 8, borderRadius: 6, textAlign: "left" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <span>{c.icon}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PriorityCycleButton({ taskId, priority }: { taskId: string; priority: TaskPriority }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function cycle() {
    const next = PRIORITY_ORDER[(PRIORITY_ORDER.indexOf(priority) + 1) % PRIORITY_ORDER.length];
    startTransition(async () => {
      await updateTaskMeta(taskId, { priority: next });
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={cycle}
      disabled={isPending}
      title="Click to change priority"
      style={{
        background: "none",
        border: `1px solid ${PRIORITY_COLOR[priority]}`,
        color: PRIORITY_COLOR[priority],
        borderRadius: 100,
        padding: "2px 10px",
        fontSize: 10.5,
        fontWeight: 700,
        textTransform: "capitalize",
        cursor: "pointer",
      }}
    >
      {priority}
    </button>
  );
}

function TaskRow({ task, onChanged }: { task: PersonalTask; onChanged: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [isBreakingDown, startBreakdown] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    startTransition(async () => {
      await toggleTask(task.id, !task.completed);
      onChanged();
    });
  }

  function handleToggleSubtask(subtaskId: string) {
    startTransition(async () => {
      await toggleSubtask(task.id, subtaskId);
      onChanged();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteTask(task.id);
      onChanged();
    });
  }

  function handleBreakdown() {
    setError(null);
    startBreakdown(async () => {
      const result = await breakdownTaskIntoSubtasks(task.id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onChanged();
    });
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <input
          type="checkbox"
          checked={task.completed}
          onChange={handleToggle}
          disabled={isPending}
          style={{ marginTop: 3, accentColor: "var(--teal)", cursor: "pointer" }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <IconPicker taskId={task.id} currentIcon={task.icon} />
            <p
              style={{
                fontSize: 14,
                color: task.completed ? "var(--text-muted)" : "var(--text)",
                textDecoration: task.completed ? "line-through" : "none",
                fontWeight: 600,
                flex: 1,
                minWidth: 120,
              }}
            >
              {task.title}
            </p>
            <PriorityCycleButton taskId={task.id} priority={task.priority} />
          </div>
          {(task.time || task.recurring !== "none") && (
            <span style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "capitalize" }}>
              {task.time && formatTime(task.time)}
              {task.time && task.recurring !== "none" && " · "}
              {task.recurring !== "none" && `Repeats ${task.recurring}`}
            </span>
          )}
          {task.subtasks.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {task.subtasks.map((s) => (
                <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={() => handleToggleSubtask(s.id)}
                    style={{ accentColor: "var(--teal)", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 12.5, color: s.done ? "var(--text-muted)" : "var(--text)", textDecoration: s.done ? "line-through" : "none" }}>
                    {s.text}
                  </span>
                </label>
              ))}
            </div>
          )}
          {error && <p style={{ color: "#f87171", fontSize: 11, marginTop: 6 }}>{error}</p>}
          <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
            {task.subtasks.length === 0 && (
              <button
                type="button"
                onClick={handleBreakdown}
                disabled={isBreakingDown}
                style={{ background: "none", border: "none", color: "var(--teal)", fontSize: 11.5, cursor: "pointer", padding: 0 }}
              >
                {isBreakingDown ? "Thinking…" : "Break down with AI"}
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11.5, cursor: "pointer", padding: 0 }}
            >
              Remove
            </button>
            <AddToCalendarControl taskId={task.id} title={task.title} recurring={task.recurring} taskDate={task.date} taskTime={task.time} />
          </div>
          <NotesControl taskId={task.id} initialNotes={task.notes} />
        </div>
      </div>
    </div>
  );
}

export default function TaskList({
  initialTasks,
  milestones,
  selectedDate,
}: {
  initialTasks: PersonalTask[];
  milestones: Milestone[];
  selectedDate?: string | null;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(selectedDate || defaultDate());
  const [recurring, setRecurring] = useState<TaskRecurring>("none");
  const [milestoneId, setMilestoneId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [icon, setIcon] = useState<string | null>(null);
  const [time, setTime] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Clicking a day on the Calendar above sets `selectedDate` in the parent;
  // this picks it up so "click a date, add an activity there" works without
  // also needing to fight the date picker for a day that isn't today.
  // Adjusting state during render (not an effect) is the React-recommended
  // pattern for "sync state to a prop that changed" — it re-renders once
  // more before committing, rather than committing the stale value first.
  const [lastSeenSelectedDate, setLastSeenSelectedDate] = useState(selectedDate);
  if (selectedDate !== lastSeenSelectedDate) {
    setLastSeenSelectedDate(selectedDate);
    if (selectedDate) setDate(selectedDate);
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createTask({ title, recurring, milestoneId: milestoneId || null, priority, icon, time: time || null, date });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setTitle("");
      setRecurring("none");
      setMilestoneId("");
      setPriority("medium");
      setIcon(null);
      setTime("");
      router.refresh();
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
        {initialTasks.length === 0 ? "No tasks yet today" : `${initialTasks.length} task${initialTasks.length === 1 ? "" : "s"} today`}
      </h2>

      {initialTasks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {initialTasks.map((t) => (
            <TaskRow key={t.id} task={t} onChanged={() => router.refresh()} />
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: initialTasks.length > 0 ? 16 : 0, borderTop: initialTasks.length > 0 ? "1px solid var(--border)" : "none" }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add an activity…"
          required
          style={inputStyle}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="date"
            lang="en-US"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Date"
            style={{ ...inputStyle, cursor: "pointer", flex: "1 1 150px", colorScheme: "dark" }}
          />
          <select value={recurring} onChange={(e) => setRecurring(e.target.value as TaskRecurring)} style={{ ...inputStyle, cursor: "pointer", flex: "1 1 140px" }}>
            <option value="none">One-time</option>
            <option value="daily">Repeat daily</option>
            <option value="weekdays">Repeat weekdays</option>
            <option value="weekly">Repeat weekly</option>
            <option value="monthly">Repeat monthly</option>
          </select>
          <input
            type="time"
            lang="en-US"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-label="Time (optional)"
            style={{ ...inputStyle, cursor: "pointer", flex: "1 1 120px" }}
          />
          {milestones.length > 0 && (
            <select value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)} style={{ ...inputStyle, cursor: "pointer", flex: "1 1 200px" }}>
              <option value="">Not linked to a milestone</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Priority:</span>
          {PRIORITY_ORDER.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              style={{
                background: priority === p ? `color-mix(in srgb, ${PRIORITY_COLOR[p]} 15%, transparent)` : "transparent",
                border: `1px solid ${PRIORITY_COLOR[p]}`,
                color: PRIORITY_COLOR[p],
                borderRadius: 100,
                padding: "3px 12px",
                fontSize: 11.5,
                fontWeight: 700,
                textTransform: "capitalize",
                cursor: "pointer",
              }}
            >
              {p}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Category:</span>
          {TASK_CATEGORIES.map((c) => (
            <button
              key={c.icon}
              type="button"
              onClick={() => setIcon(icon === c.icon ? null : c.icon)}
              title={c.label}
              style={{
                background: icon === c.icon ? "rgba(0,201,167,0.12)" : "transparent",
                border: icon === c.icon ? "1px solid rgba(0,201,167,0.4)" : "1px solid var(--border)",
                borderRadius: 100,
                padding: "3px 10px",
                fontSize: 11.5,
                color: icon === c.icon ? "var(--teal)" : "var(--text-muted)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                whiteSpace: "nowrap",
              }}
            >
              <span>{c.icon}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>
        {error && <p style={{ color: "#f87171", fontSize: 12 }}>{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          style={{
            alignSelf: "flex-start",
            background: "var(--teal)",
            color: "#0A0F1E",
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? "Adding…" : "Add task"}
        </button>
      </form>
    </div>
  );
}
