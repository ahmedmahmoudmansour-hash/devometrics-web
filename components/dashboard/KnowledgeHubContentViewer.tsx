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

export default function KnowledgeHubContentViewer({
  contentId,
  fileName,
  mimeType,
  completionType,
  passingScorePercent,
  initialCompletion,
}: {
  contentId: string;
  fileName: string;
  mimeType: string;
  completionType: KnowledgeHubCompletionType;
  passingScorePercent: number;
  initialCompletion: Completion;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<Completion>(initialCompletion);

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

  const isPdf = mimeType === "application/pdf";
  const isVideo = mimeType.startsWith("video/");

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
      setExamStarted(false);
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
        {completion ? (
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--teal)" }}>
            {completionType === "exam"
              ? `${completion.passed ? "Passed" : "Completed"} — ${completion.scorePercent}% (${passingScorePercent}% required)`
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
