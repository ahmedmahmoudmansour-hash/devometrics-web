"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createJobPosting, suggestPostingRequirements, saveJobPostingRequirements, setJobPostingStatus, deleteJobPosting } from "@/lib/hiring/postingActions";
import { COMPETENCY_DIMENSIONS } from "@/lib/gap-analysis/dimensions";
import type { RoleGradingSuggestion } from "@/lib/jobArchitecture/actions";
import type { JobPosting, JobPostingStatus } from "@/lib/hiring/types";

const card: React.CSSProperties = {
  background: "var(--navy-mid)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: 22,
};

const input: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13,
  color: "var(--text)",
  outline: "none",
};

const primaryBtn: React.CSSProperties = {
  background: "var(--teal)",
  color: "#0A0F1E",
  border: "none",
  borderRadius: 8,
  padding: "9px 16px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "9px 14px",
  fontSize: 13,
  color: "var(--text-muted)",
  cursor: "pointer",
};

const STATUS_COLOR: Record<JobPostingStatus, string> = {
  draft: "var(--text-muted)",
  open: "var(--teal)",
  closed: "#f87171",
};

type PostingRow = JobPosting & { candidateCount: number; hiredCount: number };

export default function HiringPostingsManager({ postings }: { postings: PostingRow[] }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [isPending, startTransition] = useTransition();

  function refresh() {
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {showAdd ? (
        <NewPostingForm
          onDone={() => {
            setShowAdd(false);
            refresh();
          }}
          onCancel={() => setShowAdd(false)}
        />
      ) : (
        <button type="button" style={{ ...primaryBtn, alignSelf: "flex-start" }} onClick={() => setShowAdd(true)}>
          + New job posting
        </button>
      )}

      {postings.length === 0 && !showAdd && (
        <div style={card}>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
            No job postings yet. Create one, write or paste the job description, and let AI propose the
            competency profile it requires — the same 8-dimension engine that powers Gap Analysis.
          </p>
        </div>
      )}

      {postings.map((posting) => (
        <div key={posting.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Link href={`/dashboard/company/hiring/${posting.id}`} style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", textDecoration: "none" }}>
                  {posting.title}
                </Link>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: STATUS_COLOR[posting.status],
                    border: `1px solid ${STATUS_COLOR[posting.status]}`,
                    borderRadius: 999,
                    padding: "2px 8px",
                  }}
                >
                  {posting.status}
                </span>
              </div>
              {posting.department && <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>{posting.department}</p>}
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                {posting.candidateCount} candidate{posting.candidateCount === 1 ? "" : "s"}
                {posting.hiredCount > 0 ? ` · ${posting.hiredCount} hired` : ""}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                value={posting.status}
                style={{ ...input, width: 110, cursor: "pointer" }}
                onChange={(e) =>
                  startTransition(async () => {
                    await setJobPostingStatus(posting.id, e.target.value as JobPostingStatus);
                    refresh();
                  })
                }
              >
                <option value="draft">Draft</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
              <Link href={`/dashboard/company/hiring/${posting.id}`} style={{ ...ghostBtn, textDecoration: "none", display: "inline-block" }}>
                Open pipeline →
              </Link>
              <button
                type="button"
                disabled={isPending}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}
                onClick={() =>
                  startTransition(async () => {
                    if (!confirm(`Delete "${posting.title}" and all its candidates? This can't be undone.`)) return;
                    await deleteJobPosting(posting.id);
                    refresh();
                  })
                }
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function NewPostingForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [rationale, setRationale] = useState("");
  const [reqs, setReqs] = useState<Record<string, number>>({});

  function applySuggestion(s: RoleGradingSuggestion) {
    setRationale(s.rationale);
    const next: Record<string, number> = {};
    for (const r of s.competencyRequirements) next[r.dimension] = r.targetLevel;
    setReqs(next);
  }

  return (
    <div style={{ ...card, border: "1px solid rgba(0,201,167,0.3)", background: "rgba(0,201,167,0.03)" }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>New job posting</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input style={input} placeholder="Job title — e.g. Senior Backend Engineer" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input style={input} placeholder="Department (optional)" value={department} onChange={(e) => setDepartment(e.target.value)} />
        <textarea
          style={{ ...input, resize: "vertical" }}
          rows={4}
          placeholder="Job description — pasted or written here, used to score candidate CVs against"
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
        />
        <textarea
          style={{ ...input, resize: "vertical" }}
          rows={3}
          placeholder="Key responsibilities (the AI proposes required competencies from this)"
          value={responsibilities}
          onChange={(e) => setResponsibilities(e.target.value)}
        />

        <button
          type="button"
          disabled={suggesting || !title.trim()}
          style={{ ...ghostBtn, alignSelf: "flex-start", color: "var(--teal)", borderColor: "rgba(0,201,167,0.4)", opacity: suggesting || !title.trim() ? 0.5 : 1 }}
          onClick={() => {
            setSuggesting(true);
            setError(null);
            startTransition(async () => {
              const result = await suggestPostingRequirements(title, responsibilities);
              setSuggesting(false);
              if ("error" in result) setError(result.error);
              else applySuggestion(result.suggestion);
            });
          }}
        >
          {suggesting ? "Analyzing…" : "✨ Suggest requirements with AI"}
        </button>

        {rationale && (
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5, fontStyle: "italic", borderLeft: "2px solid var(--teal)", paddingLeft: 10 }}>
            {rationale}
          </p>
        )}

        {Object.keys(reqs).length > 0 && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              Required competency levels (0 = not required) — review and edit before saving
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8 }}>
              {COMPETENCY_DIMENSIONS.map((dim) => (
                <div key={dim} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 11.5, color: "var(--text-muted)" }}>{dim}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    style={{ ...input, width: 70 }}
                    value={reqs[dim] ?? 0}
                    onChange={(e) => setReqs((prev) => ({ ...prev, [dim]: Number(e.target.value) }))}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p style={{ color: "#f87171", fontSize: 12 }}>{error}</p>}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            disabled={isPending || !title.trim()}
            style={{ ...primaryBtn, opacity: isPending || !title.trim() ? 0.5 : 1 }}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const created = await createJobPosting({ title, department, jobDescription, responsibilities });
                if (created.error || !created.postingId) {
                  setError(created.error ?? "Could not create the posting");
                  return;
                }
                const requirements = COMPETENCY_DIMENSIONS.map((dim) => ({ dimension: dim, targetLevel: reqs[dim] ?? 0 })).filter(
                  (r) => r.targetLevel > 0
                );
                if (requirements.length) await saveJobPostingRequirements(created.postingId, requirements);
                onDone();
              })
            }
          >
            {isPending ? "Creating…" : "Create posting"}
          </button>
          <button type="button" style={ghostBtn} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
