"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { addInterviewNote, deleteInterviewNote, generateCandidateAssessment } from "@/lib/hiring/interviewActions";
import { markCandidateHired } from "@/lib/hiring/hireActions";
import { stageLabel } from "@/lib/hiring/types";
import { dimensionLabel } from "@/lib/gap-analysis/dimensions";
import type {
  HiringCandidate,
  HiringCandidateCvScore,
  HiringCandidateInterviewNote,
  HiringCandidateAssessment,
  HiringCandidateStageHistoryEntry,
} from "@/lib/hiring/types";

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

function scoreColor(score: number): string {
  if (score >= 70) return "var(--teal)";
  if (score >= 40) return "var(--amber)";
  return "#f87171";
}

export default function CandidateDetailView({
  candidate,
  cvScore,
  notes,
  assessment,
  stageHistory,
}: {
  candidate: HiringCandidate;
  cvScore: HiringCandidateCvScore | null;
  notes: (HiringCandidateInterviewNote & { authorName: string })[];
  assessment: HiringCandidateAssessment | null;
  stageHistory: (HiringCandidateStageHistoryEntry & { moverName: string })[];
}) {
  const t = useTranslations("candidateDetailView");
  const tDim = useTranslations("competencyDimensions");
  const router = useRouter();
  function refresh() {
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {cvScore && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{t("cvCompetencyBreakdown")}</h2>
            <span className="mono" style={{ fontSize: 18, fontWeight: 800, color: scoreColor(cvScore.career_health_score) }}>
              {cvScore.career_health_score}
            </span>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>
            {t("cvBreakdownDescription")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...cvScore.competencies]
              .sort((a, b) => b.currentLevel - a.currentLevel)
              .map((c) => (
                <div key={c.dimension} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 150, fontSize: 11.5, color: "var(--text-muted)" }}>{dimensionLabel(tDim, c.dimension)}</span>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                    <div style={{ width: `${c.currentLevel}%`, height: "100%", background: scoreColor(c.currentLevel) }} />
                  </div>
                  <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)", width: 28, textAlign: "right" }}>{c.currentLevel}</span>
                </div>
              ))}
          </div>
        </div>
      )}
      {!cvScore && !candidate.cv_storage_path && (
        <div style={card}>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("noCvYet")}</p>
        </div>
      )}

      <InterviewNotesSection candidateId={candidate.id} notes={notes} onChanged={refresh} />

      <AssessmentSection candidateId={candidate.id} hasNotes={notes.length > 0} assessment={assessment} onChanged={refresh} />

      <HireSection candidate={candidate} onChanged={refresh} />

      <StageHistorySection stageHistory={stageHistory} />
    </div>
  );
}

function StageHistorySection({ stageHistory }: { stageHistory: (HiringCandidateStageHistoryEntry & { moverName: string })[] }) {
  const t = useTranslations("candidateDetailView");
  const tStage = useTranslations("hiringStages");
  if (stageHistory.length === 0) return null;

  return (
    <div style={card}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{t("history")}</h2>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>
        {t("historyDescription")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {stageHistory.map((h) => (
          <div key={h.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span
              style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--teal)", flexShrink: 0, marginTop: 6 }}
            />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12.5, color: "var(--text)" }}>
                {h.from_stage
                  ? t("stageTransition", { from: stageLabel(tStage, h.from_stage), to: stageLabel(tStage, h.to_stage) })
                  : t("addedAs", { stage: stageLabel(tStage, h.to_stage) })}
                <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                  {" "}
                  · {h.moverName} · {new Date(h.created_at).toLocaleDateString()}
                </span>
              </p>
              {h.note && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.5 }}>{h.note}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InterviewNotesSection({
  candidateId,
  notes,
  onChanged,
}: {
  candidateId: string;
  notes: (HiringCandidateInterviewNote & { authorName: string })[];
  onChanged: () => void;
}) {
  const t = useTranslations("candidateDetailView");
  const [isPending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div style={card}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>{t("interviewNotes")}</h2>
      {notes.length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>{t("noNotesYet")}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
        {notes.map((n) => (
          <div key={n.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, background: "rgba(255,255,255,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
                {n.authorName} · {new Date(n.created_at).toLocaleDateString()}
              </span>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer" }}
                onClick={() =>
                  startTransition(async () => {
                    await deleteInterviewNote(n.id, candidateId);
                    onChanged();
                  })
                }
              >
                {t("delete")}
              </button>
            </div>
            <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{n.note}</p>
          </div>
        ))}
      </div>
      <textarea
        style={{ ...input, resize: "vertical" }}
        rows={4}
        placeholder={t("notesPlaceholder")}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 6 }}>{error}</p>}
      <button
        type="button"
        disabled={isPending || !text.trim()}
        style={{ ...primaryBtn, marginTop: 10, opacity: isPending || !text.trim() ? 0.5 : 1 }}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await addInterviewNote(candidateId, text);
            if (result.error) setError(result.error);
            else {
              setText("");
              onChanged();
            }
          })
        }
      >
        {isPending ? t("saving") : t("addNote")}
      </button>
    </div>
  );
}

function AssessmentSection({
  candidateId,
  hasNotes,
  assessment,
  onChanged,
}: {
  candidateId: string;
  hasNotes: boolean;
  assessment: HiringCandidateAssessment | null;
  onChanged: () => void;
}) {
  const t = useTranslations("candidateDetailView");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div style={{ ...card, border: "1px solid rgba(167,139,250,0.3)", background: "rgba(167,139,250,0.03)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{t("aiAssessment")}</h2>
        <button
          type="button"
          disabled={isPending || !hasNotes}
          style={{ ...ghostBtn, color: "#a78bfa", borderColor: "rgba(167,139,250,0.3)", opacity: isPending || !hasNotes ? 0.5 : 1 }}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await generateCandidateAssessment(candidateId);
              if ("error" in result) setError(result.error);
              else onChanged();
            })
          }
        >
          {isPending ? t("analyzing") : assessment ? t("regenerate") : t("generateAssessment")}
        </button>
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.5 }}>
        {t("assessmentDescription")}
      </p>
      {!hasNotes && <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{t("addNoteFirst")}</p>}
      {error && <p style={{ color: "#f87171", fontSize: 12 }}>{error}</p>}
      {assessment && (
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
            <span className="mono" style={{ fontSize: 22, fontWeight: 800, color: scoreColor(assessment.assessment.overallScore) }}>
              {assessment.assessment.overallScore}
            </span>
            <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
              {t("basedOnNotes", { count: assessment.based_on_note_count })}
            </span>
          </div>
          {assessment.assessment.strengths.length > 0 && (
            <p style={{ fontSize: 12.5, color: "var(--teal)", marginBottom: 6, lineHeight: 1.6 }}>+ {assessment.assessment.strengths.join(" · ")}</p>
          )}
          {assessment.assessment.concerns.length > 0 && (
            <p style={{ fontSize: 12.5, color: "var(--amber)", marginBottom: 10, lineHeight: 1.6 }}>! {assessment.assessment.concerns.join(" · ")}</p>
          )}
          <p style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.6, fontStyle: "italic" }}>{assessment.assessment.recommendation}</p>
        </div>
      )}
    </div>
  );
}

function HireSection({ candidate, onChanged }: { candidate: HiringCandidate; onChanged: () => void }) {
  const t = useTranslations("candidateDetailView");
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");

  if (candidate.stage === "hired") {
    return (
      <div style={card}>
        <p style={{ fontSize: 13, color: "var(--teal)", fontWeight: 700 }}>{t("hiredLabel")}</p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          {t("hiredDescription", { email: candidate.email })}
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div style={card}>
        <p style={{ fontSize: 13, color: "var(--teal)", fontWeight: 700 }}>{t("inviteSentLabel")}</p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          {t("inviteSentDescription", { email: candidate.email })}
        </p>
      </div>
    );
  }

  return (
    <div style={card}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>{t("hireThisCandidate")}</h2>
      {!showForm ? (
        <button type="button" style={primaryBtn} onClick={() => setShowForm(true)}>
          {t("markAsHired")}
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
            {t("sendInviteDescription", { email: candidate.email })}
          </p>
          <input style={input} placeholder={t("jobTitleOptional")} value={title} onChange={(e) => setTitle(e.target.value)} />
          <input style={input} placeholder={t("departmentOptional")} value={department} onChange={(e) => setDepartment(e.target.value)} />
          {error && <p style={{ color: "#f87171", fontSize: 12 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={isPending}
              style={{ ...primaryBtn, opacity: isPending ? 0.6 : 1 }}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const result = await markCandidateHired(candidate.id, { title, department });
                  if (result.error) setError(result.error);
                  else {
                    setSuccess(true);
                    onChanged();
                  }
                })
              }
            >
              {isPending ? t("sendingInvite") : t("sendInvite")}
            </button>
            <button type="button" style={ghostBtn} onClick={() => setShowForm(false)}>
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
