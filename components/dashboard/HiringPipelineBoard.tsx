"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createCandidate, attachCandidateCv, scoreCandidateCv, moveCandidateStage, deleteCandidate } from "@/lib/hiring/candidateActions";
import { generateCandidateRanking } from "@/lib/hiring/rankingActions";
import { CANDIDATE_CV_BUCKET, CANDIDATE_CV_MAX_BYTES, CANDIDATE_CV_ALLOWED_MIME_TYPES } from "@/lib/hiring/constants";
import { HIRING_STAGES } from "@/lib/hiring/types";
import type { JobPosting, JobPostingCompetencyRequirement, HiringCandidate, HiringStage } from "@/lib/hiring/types";

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

const STAGE_LABEL: Record<HiringStage, string> = {
  applied: "Applied",
  phone_screen: "Phone screen",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
};

type CandidateRow = HiringCandidate & { careerHealthScore: number | null; hasAssessment: boolean };

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function scoreColor(score: number): string {
  if (score >= 70) return "var(--teal)";
  if (score >= 40) return "var(--amber)";
  return "#f87171";
}

export default function HiringPipelineBoard({
  organizationId,
  posting,
  requirements,
  candidates,
}: {
  organizationId: string;
  posting: JobPosting;
  requirements: JobPostingCompetencyRequirement[];
  candidates: CandidateRow[];
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [ranking, setRanking] = useState(false);
  const [rankingError, setRankingError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function refresh() {
    router.refresh();
  }

  const sortedReqs = [...requirements].sort((a, b) => b.target_level - a.target_level).filter((r) => r.target_level > 0);
  const columns = HIRING_STAGES.filter((s) => s !== "rejected");
  const rejected = candidates.filter((c) => c.stage === "rejected");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={card}>
        {posting.department && <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 8 }}>{posting.department}</p>}
        {posting.job_description && (
          <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: sortedReqs.length ? 16 : 0 }}>
            {posting.job_description}
          </p>
        )}
        {sortedReqs.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <p style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Required competencies
            </p>
            {sortedReqs.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 150, fontSize: 11.5, color: "var(--text-muted)" }}>{r.dimension}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <div style={{ width: `${r.target_level}%`, height: "100%", background: "var(--teal)" }} />
                </div>
                <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)", width: 28, textAlign: "right" }}>{r.target_level}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {showAdd ? null : (
          <button type="button" style={primaryBtn} onClick={() => setShowAdd(true)}>
            + Add candidate
          </button>
        )}
        <button
          type="button"
          disabled={ranking || candidates.filter((c) => c.stage !== "rejected").length === 0}
          style={{ ...ghostBtn, color: "#a78bfa", borderColor: "rgba(167,139,250,0.3)", opacity: ranking ? 0.6 : 1 }}
          onClick={() => {
            setRanking(true);
            setRankingError(null);
            startTransition(async () => {
              const result = await generateCandidateRanking(posting.id);
              setRanking(false);
              if ("error" in result) setRankingError(result.error);
              else refresh();
            });
          }}
        >
          {ranking ? "Comparing…" : "✨ Compare & Rank candidates"}
        </button>
      </div>
      {rankingError && <p style={{ color: "#f87171", fontSize: 12 }}>{rankingError}</p>}

      {showAdd && (
        <AddCandidateForm
          organizationId={organizationId}
          postingId={posting.id}
          onDone={() => {
            setShowAdd(false);
            refresh();
          }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {posting.ranking_report && posting.ranking_report.candidates.length > 0 && (
        <div style={{ ...card, border: "1px solid rgba(167,139,250,0.3)", background: "rgba(167,139,250,0.03)" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Candidate comparison</h2>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 14 }}>{posting.ranking_report.riskNote}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...posting.ranking_report.candidates]
              .sort((a, b) => b.fitScore - a.fitScore)
              .map((c) => {
                const candidate = candidates.find((cd) => cd.id === c.candidateId);
                return (
                  <div key={c.candidateId} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14, background: "rgba(255,255,255,0.02)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <Link
                        href={`/dashboard/company/hiring/${posting.id}/candidates/${c.candidateId}`}
                        style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", textDecoration: "none" }}
                      >
                        {c.name}
                      </Link>
                      <span className="mono" style={{ fontSize: 15, fontWeight: 800, color: scoreColor(c.fitScore) }}>{c.fitScore}</span>
                    </div>
                    {candidate && (
                      <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>{STAGE_LABEL[candidate.stage]}</p>
                    )}
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>{c.whyRanked}</p>
                    {c.strengths.length > 0 && (
                      <p style={{ fontSize: 11.5, color: "var(--teal)", marginTop: 6 }}>+ {c.strengths.join(" · ")}</p>
                    )}
                    {c.concerns.length > 0 && (
                      <p style={{ fontSize: 11.5, color: "var(--amber)", marginTop: 4 }}>! {c.concerns.join(" · ")}</p>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        {columns.map((stage) => (
          <div key={stage} style={{ ...card, padding: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
              {STAGE_LABEL[stage]} ({candidates.filter((c) => c.stage === stage).length})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {candidates
                .filter((c) => c.stage === stage)
                .map((c) => (
                  <CandidateCard key={c.id} candidate={c} postingId={posting.id} onChanged={refresh} isPending={isPending} startTransition={startTransition} />
                ))}
            </div>
          </div>
        ))}
      </div>

      {rejected.length > 0 && (
        <div style={{ ...card, padding: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
            Rejected ({rejected.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rejected.map((c) => (
              <CandidateCard key={c.id} candidate={c} postingId={posting.id} onChanged={refresh} isPending={isPending} startTransition={startTransition} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CandidateCard({
  candidate,
  postingId,
  onChanged,
  isPending,
  startTransition,
}: {
  candidate: CandidateRow;
  postingId: string;
  onChanged: () => void;
  isPending: boolean;
  startTransition: (fn: () => Promise<void> | void) => void;
}) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, background: "rgba(255,255,255,0.02)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <Link href={`/dashboard/company/hiring/${postingId}/candidates/${candidate.id}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", textDecoration: "none" }}>
          {candidate.full_name}
        </Link>
        {candidate.careerHealthScore !== null && (
          <span className="mono" style={{ fontSize: 12, fontWeight: 800, color: scoreColor(candidate.careerHealthScore) }}>
            {candidate.careerHealthScore}
          </span>
        )}
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{candidate.email}</p>
      <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
        {candidate.cv_storage_path && (
          <span style={{ fontSize: 9.5, color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 999, padding: "1px 6px" }}>CV</span>
        )}
        {candidate.hasAssessment && (
          <span style={{ fontSize: 9.5, color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 999, padding: "1px 6px" }}>Assessed</span>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
        <select
          value={candidate.stage}
          disabled={isPending}
          style={{ ...input, fontSize: 11, padding: "5px 8px", cursor: "pointer" }}
          onChange={(e) =>
            startTransition(async () => {
              await moveCandidateStage(candidate.id, e.target.value as HiringStage);
              onChanged();
            })
          }
        >
          {HIRING_STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={isPending}
          style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer", marginLeft: "auto" }}
          onClick={() =>
            startTransition(async () => {
              if (!confirm(`Remove ${candidate.full_name} from this pipeline?`)) return;
              await deleteCandidate(candidate.id);
              onChanged();
            })
          }
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function AddCandidateForm({
  organizationId,
  postingId,
  onDone,
  onCancel,
}: {
  organizationId: string;
  postingId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setFileError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (!(CANDIDATE_CV_ALLOWED_MIME_TYPES as readonly string[]).includes(f.type)) {
      setFileError("Only PDF, DOC, or DOCX files are supported.");
      return;
    }
    if (f.size > CANDIDATE_CV_MAX_BYTES) {
      setFileError("File is too large — 8MB max.");
      return;
    }
    setFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) return setError("Give the candidate a name");
    if (!email.trim().includes("@")) return setError("A valid email is required");

    startTransition(async () => {
      const created = await createCandidate(postingId, { fullName, email, phone });
      if (created.error || !created.candidateId) {
        setError(created.error ?? "Could not add the candidate");
        return;
      }
      const candidateId = created.candidateId;

      if (file) {
        try {
          setStatus("Reading CV…");
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch("/api/extract-text", { method: "POST", body: formData });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || "Failed to read the CV file");
          }
          const { text } = await res.json();

          setStatus("Uploading CV…");
          const storagePath = `${organizationId}/${candidateId}/${sanitizeFileName(file.name)}`;
          const supabase = createClient();
          const { error: uploadError } = await supabase.storage.from(CANDIDATE_CV_BUCKET).upload(storagePath, file);
          if (uploadError) throw new Error(uploadError.message);

          await attachCandidateCv(candidateId, {
            storagePath,
            fileName: file.name,
            fileSizeBytes: file.size,
            mimeType: file.type,
          });

          setStatus("Scoring CV…");
          const scored = await scoreCandidateCv(candidateId, text);
          if ("error" in scored) setError(scored.error);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Candidate added, but the CV could not be processed");
        }
      }

      setStatus(null);
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ ...card, border: "1px solid rgba(0,201,167,0.3)", background: "rgba(0,201,167,0.03)" }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>Add candidate</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input style={input} placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <input style={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input style={input} placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />

        <div>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={handleFileChange} id="candidate-cv-upload" style={{ display: "none" }} />
          <label htmlFor="candidate-cv-upload" style={{ fontSize: 12, color: "var(--teal)", cursor: "pointer", textDecoration: "underline" }}>
            {file ? `CV: ${file.name}` : "Attach CV (PDF, DOC, or DOCX)"}
          </label>
          {fileError && <p style={{ color: "#f87171", fontSize: 11, marginTop: 4 }}>{fileError}</p>}
        </div>

        {status && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{status}</p>}
        {error && <p style={{ color: "#f87171", fontSize: 12 }}>{error}</p>}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={isPending} style={{ ...primaryBtn, opacity: isPending ? 0.6 : 1 }}>
            {isPending ? "Adding…" : "Add candidate"}
          </button>
          <button type="button" style={ghostBtn} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
