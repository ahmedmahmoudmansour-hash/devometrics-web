"use client";

import { Fragment, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileText, PhoneCall, Users, Handshake, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createCandidate, attachCandidateCv, scoreCandidateCv, moveCandidateStage, deleteCandidate } from "@/lib/hiring/candidateActions";
import { generateCandidateRanking } from "@/lib/hiring/rankingActions";
import { generateInterviewQuestions } from "@/lib/hiring/postingActions";
import { CANDIDATE_CV_BUCKET, CANDIDATE_CV_MAX_BYTES, CANDIDATE_CV_ALLOWED_MIME_TYPES } from "@/lib/hiring/constants";
import { HIRING_STAGES, stageLabel } from "@/lib/hiring/types";
import { dimensionLabel, type CompetencyDimension } from "@/lib/gap-analysis/dimensions";
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

// One icon per stage of the pipeline, so the process reads as a sequence
// at a glance rather than an unlabeled set of columns — same order as
// HIRING_STAGES (the fixed applied -> ... -> hired progression).
const STAGE_ICON: Record<HiringStage, React.ComponentType<{ size?: number }>> = {
  applied: FileText,
  phone_screen: PhoneCall,
  interview: Users,
  offer: Handshake,
  hired: CheckCircle2,
  rejected: XCircle,
};

type CandidateRow = HiringCandidate & { careerHealthScore: number | null; hasAssessment: boolean };

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function scoreColor(score: number): string {
  if (score >= 70) return "var(--teal)";
  if (score >= 40) return "var(--amber)";
  return "var(--danger)";
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
  const t = useTranslations("hiringPipelineBoard");
  const tStage = useTranslations("hiringStages");
  const tDim = useTranslations("competencyDimensions");
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

  // Free, instant CV-score sort — no AI call, just what's already fetched.
  // Separate from "Compare & Rank" below, which is a deliberate AI judgment
  // call across CV + interview data and costs a real request; this is just
  // "who's leading on CV score right now."
  const topByCvScore = candidates
    .filter((c) => c.stage !== "rejected" && c.careerHealthScore !== null)
    .sort((a, b) => (b.careerHealthScore ?? 0) - (a.careerHealthScore ?? 0))
    .slice(0, 5);

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
              {t("requiredCompetencies")}
            </p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, lineHeight: 1.5 }}>
              {t("requiredCompetenciesDescription")}
            </p>
            {sortedReqs.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 150, fontSize: 11.5, color: "var(--text-muted)" }}>{dimensionLabel(tDim, r.dimension as CompetencyDimension)}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <div style={{ width: `${r.target_level}%`, height: "100%", background: "var(--teal)" }} />
                </div>
                <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)", width: 28, textAlign: "right" }}>{r.target_level}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <InterviewQuestionsSection posting={posting} hasRequirements={sortedReqs.length > 0} />

      {topByCvScore.length > 0 && (
        <div style={card}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{t("topCandidatesByCvScore")}</h2>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
            {t("topCandidatesDescription")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {topByCvScore.map((c, i) => (
              <Link
                key={c.id}
                href={`/dashboard/company/hiring/${posting.id}/candidates/${c.id}`}
                style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
              >
                <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)", width: 14 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13, color: "var(--text)" }}>{c.full_name}</span>
                <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{stageLabel(tStage, c.stage)}</span>
                <span className="mono" style={{ fontSize: 13, fontWeight: 800, color: scoreColor(c.careerHealthScore ?? 0), width: 28, textAlign: "right" }}>
                  {c.careerHealthScore}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {showAdd ? null : (
          <button type="button" style={primaryBtn} onClick={() => setShowAdd(true)}>
            {t("addCandidate")}
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
          {ranking ? t("comparing") : t("compareAndRank")}
        </button>
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: -4 }}>
        {t("compareDescription")}
      </p>
      {rankingError && <p style={{ color: "var(--danger)", fontSize: 12 }}>{rankingError}</p>}

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
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{t("candidateComparison")}</h2>
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
                      <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>{stageLabel(tStage, candidate.stage)}</p>
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

      {/* Fixed left-to-right order (never a reflowing/wrapping grid) so the
          pipeline reads as an actual sequence — applied -> ... -> hired,
          each stage with its own icon, connected by chevrons. Columns
          shrink to fit the available width instead of scrolling — an
          explicit column-count grid (not auto-fit/auto-fill) never
          reorders or wraps, it just narrows each column. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: columns.map(() => "minmax(0, 1fr)").join(" 20px "),
          alignItems: "flex-start",
        }}
      >
        {columns.map((stage, i) => {
          const StageIcon = STAGE_ICON[stage];
          return (
            <Fragment key={stage}>
              <div style={{ ...card, padding: 14, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <StageIcon size={14} />
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {t("stageColumnHeader", { stage: stageLabel(tStage, stage), count: candidates.filter((c) => c.stage === stage).length })}
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {candidates
                    .filter((c) => c.stage === stage)
                    .sort((a, b) => (b.careerHealthScore ?? -1) - (a.careerHealthScore ?? -1))
                    .map((c) => (
                      <CandidateCard key={c.id} candidate={c} postingId={posting.id} onChanged={refresh} isPending={isPending} startTransition={startTransition} />
                    ))}
                </div>
              </div>
              {i < columns.length - 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", alignSelf: "stretch" }}>
                  <ChevronRight size={16} />
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      {rejected.length > 0 && (
        <div style={{ ...card, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <STAGE_ICON.rejected size={14} />
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {t("rejectedHeader", { count: rejected.length })}
            </p>
          </div>
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

function InterviewQuestionsSection({ posting, hasRequirements }: { posting: JobPosting; hasRequirements: boolean }) {
  const t = useTranslations("hiringPipelineBoard");
  const tDim = useTranslations("competencyDimensions");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const questions = posting.interview_questions ?? [];

  return (
    <div style={{ ...card, border: "1px solid rgba(167,139,250,0.3)", background: "rgba(167,139,250,0.03)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{t("interviewQuestions")}</h2>
        <button
          type="button"
          disabled={isPending || !hasRequirements}
          style={{ ...ghostBtn, color: "#a78bfa", borderColor: "rgba(167,139,250,0.3)", opacity: isPending || !hasRequirements ? 0.5 : 1 }}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await generateInterviewQuestions(posting.id);
              if ("error" in result) setError(result.error);
              else router.refresh();
            })
          }
        >
          {isPending ? t("drafting") : questions.length > 0 ? t("regenerate") : t("generateQuestions")}
        </button>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>
        {t("interviewQuestionsDescription")}
      </p>
      {!hasRequirements && <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{t("setRequirementsFirst")}</p>}
      {error && <p style={{ color: "var(--danger)", fontSize: 12 }}>{error}</p>}
      {questions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {questions.map((q, i) => (
            <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, background: "rgba(255,255,255,0.02)" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.05em" }}>{dimensionLabel(tDim, q.dimension as CompetencyDimension)}</span>
              <p style={{ fontSize: 13.5, color: "var(--text)", marginTop: 4, lineHeight: 1.5 }}>{q.question}</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5, fontStyle: "italic" }}>{q.whatToListenFor}</p>
            </div>
          ))}
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
  const t = useTranslations("hiringPipelineBoard");
  const tStage = useTranslations("hiringStages");
  // A move isn't fired the instant the select changes — it's held as
  // "pending" so an optional one-line reason can be attached first (mainly
  // for Rejected, but useful for any stage), then confirmed or cancelled.
  // Cancelling just clears pendingStage, which snaps the select back to
  // candidate.stage since that's what it's bound to when nothing's pending.
  const [pendingStage, setPendingStage] = useState<HiringStage | null>(null);
  const [note, setNote] = useState("");

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
          value={pendingStage ?? candidate.stage}
          disabled={isPending}
          style={{ ...input, fontSize: 11, padding: "5px 8px", cursor: "pointer" }}
          onChange={(e) => {
            const next = e.target.value as HiringStage;
            if (next === candidate.stage) {
              setPendingStage(null);
              return;
            }
            setPendingStage(next);
            setNote("");
          }}
        >
          {HIRING_STAGES.map((s) => (
            <option key={s} value={s}>
              {stageLabel(tStage, s)}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={isPending}
          style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer", marginLeft: "auto" }}
          onClick={() =>
            startTransition(async () => {
              if (!confirm(t("removeConfirm", { name: candidate.full_name }))) return;
              await deleteCandidate(candidate.id);
              onChanged();
            })
          }
        >
          {t("remove")}
        </button>
      </div>
      {pendingStage && (
        <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 6 }}>
            {t("moveToStage", { stage: stageLabel(tStage, pendingStage) })}
            {pendingStage === "rejected" ? t("moveRejectedSuffix") : t("moveNoteSuffix")}
          </p>
          <textarea
            autoFocus
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={pendingStage === "rejected" ? t("rejectedNotePlaceholder") : t("moveNotePlaceholder")}
            style={{ ...input, fontSize: 11, padding: "6px 8px", resize: "vertical", marginBottom: 6 }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              disabled={isPending}
              style={{ ...primaryBtn, fontSize: 11, padding: "5px 12px" }}
              onClick={() =>
                startTransition(async () => {
                  await moveCandidateStage(candidate.id, pendingStage, note);
                  setPendingStage(null);
                  onChanged();
                })
              }
            >
              {t("confirmMove")}
            </button>
            <button type="button" style={{ ...ghostBtn, fontSize: 11, padding: "5px 12px" }} onClick={() => setPendingStage(null)}>
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
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
  const t = useTranslations("hiringPipelineBoard");
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
      setFileError(t("onlyPdfDocSupported"));
      return;
    }
    if (f.size > CANDIDATE_CV_MAX_BYTES) {
      setFileError(t("fileTooLarge"));
      return;
    }
    setFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) return setError(t("giveCandidateName"));
    if (!email.trim().includes("@")) return setError(t("validEmailRequired"));

    startTransition(async () => {
      const created = await createCandidate(postingId, { fullName, email, phone });
      if (created.error || !created.candidateId) {
        setError(created.error ?? t("couldNotAddCandidate"));
        return;
      }
      const candidateId = created.candidateId;

      if (file) {
        try {
          setStatus(t("readingCv"));
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch("/api/extract-text", { method: "POST", body: formData });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || t("failedToReadCv"));
          }
          const { text } = await res.json();

          setStatus(t("uploadingCv"));
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

          setStatus(t("scoringCv"));
          const scored = await scoreCandidateCv(candidateId, text);
          if ("error" in scored) setError(scored.error);
        } catch (err) {
          setError(err instanceof Error ? err.message : t("candidateAddedCvFailed"));
        }
      }

      setStatus(null);
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ ...card, border: "1px solid rgba(var(--teal-rgb),0.3)", background: "rgba(var(--teal-rgb),0.03)" }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>{t("addCandidateTitle")}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input style={input} placeholder={t("fullNamePlaceholder")} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <input style={input} type="email" placeholder={t("emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} />
        <input style={input} placeholder={t("phonePlaceholder")} value={phone} onChange={(e) => setPhone(e.target.value)} />

        <div>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={handleFileChange} id="candidate-cv-upload" style={{ display: "none" }} />
          <label htmlFor="candidate-cv-upload" style={{ fontSize: 12, color: "var(--teal)", cursor: "pointer", textDecoration: "underline" }}>
            {file ? t("cvFileLabel", { fileName: file.name }) : t("attachCv")}
          </label>
          {fileError && <p style={{ color: "var(--danger)", fontSize: 11, marginTop: 4 }}>{fileError}</p>}
        </div>

        {status && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{status}</p>}
        {error && <p style={{ color: "var(--danger)", fontSize: 12 }}>{error}</p>}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={isPending} style={{ ...primaryBtn, opacity: isPending ? 0.6 : 1 }}>
            {isPending ? t("adding") : t("addCandidateTitle")}
          </button>
          <button type="button" style={ghostBtn} onClick={onCancel}>
            {t("cancel")}
          </button>
        </div>
      </div>
    </form>
  );
}
