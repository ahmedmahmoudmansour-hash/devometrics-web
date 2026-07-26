"use client";

import { useEffect, useState } from "react";
import {
  getSignedKnowledgeHubUrl,
  confirmKnowledgeHubRead,
  getKnowledgeHubExamQuestions,
  submitKnowledgeHubExam,
} from "@/lib/knowledgeHub/actions";
import type { KnowledgeHubCompletionType, KnowledgeHubExamQuestionForTaking } from "@/lib/supabase/types";

type Completion = { scorePercent: number | null; passed: boolean } | null;

const RETRY_COOLDOWN_MS = 2 * 60 * 60 * 1000;

export default function KnowledgeHubContentViewer({
  contentId,
  fileName,
  mimeType,
  completionType,
  passingScorePercent,
  maxAttempts,
  initialExamAttemptCount,
  initialLastAttemptAt,
  initialCompletion,
}: {
  contentId: string;
  fileName: string;
  mimeType: string;
  completionType: KnowledgeHubCompletionType;
  passingScorePercent: number;
  // Only meaningful when completionType === "exam" — null means unlimited.
  maxAttempts: number | null;
  initialExamAttemptCount: number;
  initialLastAttemptAt: string | null;
  initialCompletion: Completion;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<Completion>(initialCompletion);
  const [examAttemptCount, setExamAttemptCount] = useState(initialExamAttemptCount);
  const [lastAttemptAt, setLastAttemptAt] = useState<string | null>(initialLastAttemptAt);
  // Updated every 30s purely so the cooldown countdown below counts down
  // live instead of only updating on the next user interaction. Reading
  // Date.now() directly during render is impure, so it's captured in state
  // instead.
  const [now, setNow] = useState(() => Date.now());

  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const [examStarted, setExamStarted] = useState(false);
  const [questions, setQuestions] = useState<KnowledgeHubExamQuestionForTaking[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [examLoading, setExamLoading] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSignedKnowledgeHubUrl(contentId).then((result) => {
      if (cancelled) return;
      if ("error" in result) setUrlError(result.error);
      else setSignedUrl(result.url ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [contentId]);

  // Only relevant while a failed exam is showing a cooldown countdown —
  // no point ticking otherwise.
  useEffect(() => {
    if (!lastAttemptAt || completion?.passed !== false) return;
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, [lastAttemptAt, completion]);

  const isPdf = mimeType === "application/pdf";
  const isVideo = mimeType.startsWith("video/");

  const attemptsExhausted = maxAttempts !== null && examAttemptCount >= maxAttempts;
  const retryEligibleAt = lastAttemptAt ? new Date(lastAttemptAt).getTime() + RETRY_COOLDOWN_MS : null;
  const cooldownRemainingMs = retryEligibleAt ? retryEligibleAt - now : 0;
  const cooldownActive = cooldownRemainingMs > 0;

  function formatCooldown(ms: number): string {
    const totalMinutes = Math.max(1, Math.ceil(ms / 60_000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  }

  async function handleConfirmRead() {
    setConfirming(true);
    setConfirmError(null);
    const result = await confirmKnowledgeHubRead(contentId);
    if (result?.error) setConfirmError(result.error);
    else setCompletion({ scorePercent: null, passed: true });
    setConfirming(false);
  }

  async function handleStartExam() {
    setExamLoading(true);
    setExamError(null);
    const result = await getKnowledgeHubExamQuestions(contentId);
    if ("error" in result) {
      setExamError(result.error);
    } else {
      setQuestions(result.questions ?? []);
      setExamStarted(true);
    }
    setExamLoading(false);
  }

  async function handleSubmitExam() {
    if (Object.keys(answers).length < questions.length) {
      setExamError("Answer every question before submitting.");
      return;
    }
    setSubmitting(true);
    setExamError(null);
    const payload = questions.map((q) => ({ question_id: q.question_id, selected_index: answers[q.question_id] }));
    const result = await submitKnowledgeHubExam(contentId, payload);
    if ("error" in result) {
      setExamError(result.error);
    } else {
      setCompletion({ scorePercent: result.scorePercent, passed: result.passed });
      setExamAttemptCount(result.attemptNumber);
      setLastAttemptAt(new Date().toISOString());
      setExamStarted(false);
      setAnswers({});
    }
    setSubmitting(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
        {urlError ? (
          <p style={{ fontSize: 13, color: "#f87171" }}>{urlError}</p>
        ) : !signedUrl ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading document…</p>
        ) : isPdf ? (
          <iframe
            src={signedUrl}
            title={fileName}
            style={{ width: "100%", height: 600, border: "none", borderRadius: 8, background: "#fff" }}
          />
        ) : isVideo ? (
          <video controls src={signedUrl} style={{ width: "100%", maxHeight: 480, borderRadius: 8, background: "#000" }} />
        ) : (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
              {fileName} can&apos;t be previewed in-browser — download it to view.
            </p>
            <a
              href={signedUrl}
              download={fileName}
              style={{
                display: "inline-block",
                background: "var(--teal)",
                color: "#0A0F1E",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Download {fileName}
            </a>
          </div>
        )}
      </div>

      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
        {completion && completionType === "exam" && completion.passed === false && !examStarted ? (
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#f0b840" }}>
              Scored {completion.scorePercent}% ({passingScorePercent}% required) — not yet passed
            </p>
            {examError && <p style={{ fontSize: 13, color: "#f87171", marginTop: 8 }}>{examError}</p>}
            {attemptsExhausted ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.5 }}>
                You&apos;ve used all {maxAttempts} attempt{maxAttempts === 1 ? "" : "s"} for this exam — contact your admin.
              </p>
            ) : (
              <>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.5 }}>
                  Review the material above again before retrying
                  {maxAttempts !== null && ` — you have ${maxAttempts - examAttemptCount} attempt${maxAttempts - examAttemptCount === 1 ? "" : "s"} left`}.
                </p>
                {cooldownActive ? (
                  <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
                    You can retake this exam in {formatCooldown(cooldownRemainingMs)}.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartExam}
                    disabled={examLoading}
                    style={{
                      marginTop: 12,
                      background: "var(--teal)",
                      color: "#0A0F1E",
                      border: "none",
                      borderRadius: 8,
                      padding: "10px 20px",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                      opacity: examLoading ? 0.6 : 1,
                    }}
                  >
                    {examLoading ? "Loading…" : "Try again"}
                  </button>
                )}
              </>
            )}
          </div>
        ) : completion && !examStarted ? (
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--teal)" }}>
            {completionType === "exam"
              ? `Passed — ${completion.scorePercent}% (${passingScorePercent}% required)`
              : "✓ You confirmed you've read this"}
          </p>
        ) : completionType === "attestation" ? (
          <>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
              Once you&apos;ve read the document above, confirm below.
            </p>
            {confirmError && <p style={{ fontSize: 13, color: "#f87171", marginBottom: 12 }}>{confirmError}</p>}
            <button
              type="button"
              onClick={handleConfirmRead}
              disabled={confirming}
              style={{
                background: "var(--teal)",
                color: "#0A0F1E",
                border: "none",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                opacity: confirming ? 0.6 : 1,
              }}
            >
              {confirming ? "Confirming…" : "I confirm I've read this"}
            </button>
          </>
        ) : !examStarted ? (
          <>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
              This content requires passing an exam ({passingScorePercent}% required).
            </p>
            {examError && <p style={{ fontSize: 13, color: "#f87171", marginBottom: 12 }}>{examError}</p>}
            <button
              type="button"
              onClick={handleStartExam}
              disabled={examLoading}
              style={{
                background: "var(--teal)",
                color: "#0A0F1E",
                border: "none",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                opacity: examLoading ? 0.6 : 1,
              }}
            >
              {examLoading ? "Loading…" : "Start exam"}
            </button>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {questions.map((q, i) => (
              <div key={q.question_id}>
                <p style={{ fontSize: 14, color: "var(--text)", fontWeight: 600, marginBottom: 8 }}>
                  {i + 1}. {q.prompt}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {q.options.map((opt, oIndex) => (
                    <label
                      key={oIndex}
                      style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-muted)", cursor: "pointer" }}
                    >
                      <input
                        type="radio"
                        name={q.question_id}
                        checked={answers[q.question_id] === oIndex}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q.question_id]: oIndex }))}
                        style={{ accentColor: "var(--teal)" }}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {examError && <p style={{ fontSize: 13, color: "#f87171" }}>{examError}</p>}
            <button
              type="button"
              onClick={handleSubmitExam}
              disabled={submitting}
              style={{
                alignSelf: "flex-start",
                background: "var(--teal)",
                color: "#0A0F1E",
                border: "none",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? "Submitting…" : "Submit exam"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
