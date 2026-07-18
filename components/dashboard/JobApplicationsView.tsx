"use client";

import { useState, useTransition } from "react";
import {
  createJobApplication,
  updateJobApplication,
  deleteJobApplication,
  listJobApplications,
} from "@/lib/jobApplications/actions";
import {
  JOB_APPLICATION_STAGES,
  ACTIVE_STAGES,
  stageLabel,
  type JobApplication,
  type JobApplicationStage,
} from "@/lib/jobApplications/types";

const STAGE_COLORS: Record<JobApplicationStage, string> = {
  saved: "148,163,184", // slate
  applied: "0,201,167", // teal
  phone_screen: "96,165,250", // blue
  interview: "240,184,64", // amber
  offer: "167,139,250", // violet
  accepted: "74,222,128", // green
  rejected: "248,113,113", // red
  withdrawn: "148,163,184",
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

function labelStyle(): React.CSSProperties {
  return { fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, display: "block" };
}

function AddApplicationForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [location, setLocation] = useState("");
  const [source, setSource] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [stage, setStage] = useState<JobApplicationStage>("saved");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setCompany("");
    setRoleTitle("");
    setLocation("");
    setSource("");
    setJobUrl("");
    setStage("saved");
    setOpen(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createJobApplication({
        company,
        roleTitle,
        location,
        source,
        jobUrl,
        stage,
        appliedDate: stage === "saved" ? null : new Date().toISOString().slice(0, 10),
      });
      if (result?.error) setError(result.error);
      else {
        reset();
        onAdded();
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: "rgba(0,201,167,0.1)",
          border: "1px solid rgba(0,201,167,0.3)",
          borderRadius: 10,
          padding: "10px 16px",
          fontSize: 13,
          fontWeight: 700,
          color: "var(--teal)",
          cursor: "pointer",
        }}
      >
        + Add application
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      style={{
        background: "var(--navy-mid)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle()}>Company *</label>
          <input style={inputStyle()} value={company} onChange={(e) => setCompany(e.target.value)} required autoFocus />
        </div>
        <div>
          <label style={labelStyle()}>Role title *</label>
          <input style={inputStyle()} value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} required />
        </div>
        <div>
          <label style={labelStyle()}>Location</label>
          <input style={inputStyle()} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Remote, city…" />
        </div>
        <div>
          <label style={labelStyle()}>Source</label>
          <input style={inputStyle()} value={source} onChange={(e) => setSource(e.target.value)} placeholder="LinkedIn, referral…" />
        </div>
        <div>
          <label style={labelStyle()}>Job posting URL</label>
          <input style={inputStyle()} value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div>
          <label style={labelStyle()}>Stage</label>
          <select style={{ ...inputStyle(), cursor: "pointer" }} value={stage} onChange={(e) => setStage(e.target.value as JobApplicationStage)}>
            {JOB_APPLICATION_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <p style={{ color: "#f87171", fontSize: 12 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="submit"
          disabled={isPending}
          style={{
            background: "var(--teal)",
            color: "#0A0F1E",
            border: "none",
            borderRadius: 8,
            padding: "9px 18px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={reset}
          style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ApplicationCard({ app, onChanged }: { app: JobApplication; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [nextAction, setNextAction] = useState(app.next_action ?? "");
  const [nextActionDate, setNextActionDate] = useState(app.next_action_date ?? "");
  const [salaryRange, setSalaryRange] = useState(app.salary_range ?? "");
  const [notes, setNotes] = useState(app.notes ?? "");
  const [isPending, startTransition] = useTransition();
  const color = STAGE_COLORS[app.stage];

  function changeStage(next: JobApplicationStage) {
    startTransition(async () => {
      await updateJobApplication(app.id, {
        stage: next,
        appliedDate: app.applied_date ?? (next === "saved" ? null : new Date().toISOString().slice(0, 10)),
      });
      onChanged();
    });
  }

  function saveDetails() {
    startTransition(async () => {
      await updateJobApplication(app.id, { nextAction, nextActionDate, salaryRange, notes });
      onChanged();
    });
  }

  function remove() {
    if (!confirm(`Remove ${app.role_title} at ${app.company}?`)) return;
    startTransition(async () => {
      await deleteJobApplication(app.id);
      onChanged();
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text)" }}>{app.role_title}</p>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
            {app.company}
            {app.location ? ` · ${app.location}` : ""}
            {app.source ? ` · via ${app.source}` : ""}
          </p>
          {app.job_url && (
            <a href={app.job_url} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: "var(--teal)" }}>
              View posting ↗
            </a>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select
            aria-label="Stage"
            value={app.stage}
            disabled={isPending}
            onChange={(e) => changeStage(e.target.value as JobApplicationStage)}
            style={{
              background: `rgba(${color},0.12)`,
              border: `1px solid rgba(${color},0.35)`,
              borderRadius: 8,
              padding: "6px 10px",
              fontSize: 12,
              fontWeight: 700,
              color: `rgb(${color})`,
              outline: "none",
              cursor: "pointer",
            }}
          >
            {JOB_APPLICATION_STAGES.map((s) => (
              <option key={s.value} value={s.value} style={{ color: "#000" }}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }}
          >
            {expanded ? "Hide" : "Details"}
          </button>
        </div>
      </div>

      {app.next_action && !expanded && (
        <p style={{ fontSize: 12, color: "var(--amber)", marginTop: 10 }}>
          Next: {app.next_action}
          {app.next_action_date ? ` — ${new Date(app.next_action_date).toLocaleDateString()}` : ""}
        </p>
      )}

      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle()}>Next action</label>
              <input style={inputStyle()} value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Follow up, prep for interview…" />
            </div>
            <div>
              <label style={labelStyle()}>Next action date</label>
              <input type="date" style={inputStyle()} value={nextActionDate} onChange={(e) => setNextActionDate(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle()}>Salary range</label>
              <input style={inputStyle()} value={salaryRange} onChange={(e) => setSalaryRange(e.target.value)} placeholder="$90k–$110k" />
            </div>
          </div>
          <div>
            <label style={labelStyle()}>Notes</label>
            <textarea
              style={{ ...inputStyle(), minHeight: 70, resize: "vertical", fontFamily: "inherit" }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Interviewer names, questions asked, how it went…"
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              type="button"
              onClick={saveDetails}
              disabled={isPending}
              style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
            >
              {isPending ? "Saving…" : "Save details"}
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={isPending}
              style={{ background: "none", border: "none", color: "#f87171", fontSize: 12, cursor: "pointer" }}
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function JobApplicationsView({ initial }: { initial: JobApplication[] }) {
  const [applications, setApplications] = useState(initial);
  const [, startTransition] = useTransition();
  const [filter, setFilter] = useState<"active" | "all">("active");

  function refresh() {
    startTransition(async () => {
      const result = await listJobApplications();
      setApplications(result.applications);
    });
  }

  const activeCount = applications.filter((a) => ACTIVE_STAGES.includes(a.stage)).length;
  const offerCount = applications.filter((a) => a.stage === "offer").length;
  const visible = filter === "active" ? applications.filter((a) => !["rejected", "withdrawn"].includes(a.stage)) : applications;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 18px", minWidth: 120 }}>
          <p style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>{applications.length}</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Total tracked</p>
        </div>
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 18px", minWidth: 120 }}>
          <p style={{ fontSize: 20, fontWeight: 800, color: "var(--teal)" }}>{activeCount}</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>In motion</p>
        </div>
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 18px", minWidth: 120 }}>
          <p style={{ fontSize: 20, fontWeight: 800, color: "var(--amber)" }}>{offerCount}</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Offers</p>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <AddApplicationForm onAdded={refresh} />
        <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, padding: 3 }}>
          {(["active", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? "var(--teal)" : "transparent",
                color: filter === f ? "#0A0F1E" : "var(--text-muted)",
                border: "none",
                borderRadius: 6,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {f === "active" ? "Active" : "All"}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            {applications.length === 0 ? "No applications tracked yet — add your first one above." : "Nothing in this view."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map((app) => (
            <ApplicationCard key={app.id} app={app} onChanged={refresh} />
          ))}
        </div>
      )}
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
        {stageLabel("saved")} through {stageLabel("withdrawn")} — fully private to you. Not visible to your
        organization or its admins.
      </p>
    </div>
  );
}
