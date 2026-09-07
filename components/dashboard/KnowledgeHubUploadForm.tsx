"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createKnowledgeHubContent } from "@/lib/knowledgeHub/actions";
import { validateAndRegisterScormPackage } from "@/lib/knowledgeHub/scorm/ingest";
import { useResumableUpload } from "@/lib/knowledgeHub/useResumableUpload";
import {
  KNOWLEDGE_HUB_BUCKET,
  KNOWLEDGE_HUB_ALLOWED_MIME_TYPES,
  KNOWLEDGE_HUB_SCORM_ZIP_MIME_TYPES,
  getKnowledgeHubMaxBytes,
} from "@/lib/knowledgeHub/constants";
import type { KnowledgeHubCompletionType } from "@/lib/supabase/types";

type ContentKind = "document" | "scorm";

type DraftQuestion = { prompt: string; options: string[]; correctIndex: number };

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
};

function newQuestion(): DraftQuestion {
  return { prompt: "", options: ["", ""], correctIndex: 0 };
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export default function KnowledgeHubUploadForm({ organizationId, courses }: { organizationId: string; courses: { id: string; title: string }[] }) {
  const t = useTranslations("knowledgeHubUploadForm");
  const [expanded, setExpanded] = useState(false);
  const [kind, setKind] = useState<ContentKind>("document");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [completionType, setCompletionType] = useState<KnowledgeHubCompletionType>("attestation");
  const [passingScore, setPassingScore] = useState(80);
  const [maxAttempts, setMaxAttempts] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [isNewHireContent, setIsNewHireContent] = useState(false);
  const [courseId, setCourseId] = useState<string>("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([newQuestion()]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const resumableUpload = useResumableUpload();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    const allowedTypes: readonly string[] = kind === "scorm" ? KNOWLEDGE_HUB_SCORM_ZIP_MIME_TYPES : KNOWLEDGE_HUB_ALLOWED_MIME_TYPES;
    // Some browsers/OSes report a zip's type as "" rather than a real MIME
    // type — fall back to checking the extension in that case so a real
    // zip isn't rejected on a browser quirk.
    const looksLikeZip = kind === "scorm" && (allowedTypes.includes(f.type) || f.name.toLowerCase().endsWith(".zip"));
    if (kind === "scorm" ? !looksLikeZip : !allowedTypes.includes(f.type)) {
      setError(kind === "scorm" ? t("onlyZipSupported") : t("onlyDocsSupported"));
      return;
    }
    // Checked here, at file selection, before any upload starts — not only
    // at final DB insert (createKnowledgeHubContent re-checks server-side
    // too, but nobody should sit through a multi-hundred-MB upload just to
    // be rejected at the end for a size that was already knowable now).
    const maxBytes = getKnowledgeHubMaxBytes(f.type, kind);
    if (f.size > maxBytes) {
      setError(t("fileTooLargeForType", { mb: Math.round(maxBytes / (1024 * 1024)) }));
      return;
    }
    setFile(f);
  }

  function updateQuestion(index: number, next: Partial<DraftQuestion>) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...next } : q)));
  }

  function updateOption(qIndex: number, oIndex: number, value: string) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, options: q.options.map((o, j) => (j === oIndex ? value : o)) } : q))
    );
  }

  function addOption(qIndex: number) {
    setQuestions((prev) => prev.map((q, i) => (i === qIndex && q.options.length < 6 ? { ...q, options: [...q.options, ""] } : q)));
  }

  function removeOption(qIndex: number, oIndex: number) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex || q.options.length <= 2) return q;
        const options = q.options.filter((_, j) => j !== oIndex);
        return { ...q, options, correctIndex: q.correctIndex >= options.length ? 0 : q.correctIndex };
      })
    );
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, newQuestion()]);
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) return setError(t("titleRequired"));
    if (!file) return setError(t("chooseFile"));
    if (kind === "document" && completionType === "exam") {
      for (const q of questions) {
        if (!q.prompt.trim()) return setError(t("everyQuestionNeedsPrompt"));
        if (q.options.some((o) => !o.trim())) return setError(t("everyOptionNeedsText"));
      }
    }

    function resetForm() {
      setTitle("");
      setDescription("");
      setFile(null);
      setKind("document");
      setCompletionType("attestation");
      setMaxAttempts("");
      setDueDate("");
      setIsNewHireContent(false);
      setCourseId("");
      setQuestions([newQuestion()]);
      setExpanded(false);
      resumableUpload.reset();
      router.refresh();
    }

    try {
      const contentId = crypto.randomUUID();
      const storagePath = `${organizationId}/${contentId}/${sanitizeFileName(file.name)}`;
      await resumableUpload.start(KNOWLEDGE_HUB_BUCKET, storagePath, file);

      if (kind === "scorm") {
        startTransition(async () => {
          const result = await validateAndRegisterScormPackage({
            contentId,
            title,
            description,
            rawZipStoragePath: storagePath,
            maxAttempts: null,
            dueDate: dueDate || null,
            isNewHireContent,
            courseId: courseId || null,
          });
          if ("error" in result) {
            setError(result.error);
            return;
          }
          resetForm();
        });
      } else {
        startTransition(async () => {
          const result = await createKnowledgeHubContent({
            id: contentId,
            title,
            description,
            storagePath,
            fileName: file.name,
            fileSizeBytes: file.size,
            mimeType: file.type,
            completionType,
            passingScorePercent: passingScore,
            maxAttempts: maxAttempts.trim() ? Number(maxAttempts) : null,
            dueDate: dueDate || null,
            isNewHireContent,
            questions: completionType === "exam" ? questions.map((q) => ({ ...q, options: q.options.map((o) => o.trim()) })) : undefined,
            courseId: courseId || null,
          });
          if (result?.error) {
            setError(result.error);
            return;
          }
          resetForm();
        });
      }
    } catch (err) {
      // resumableUpload.start() already recorded the error internally
      // (surfaced below via resumableUpload.error with Retry/Cancel); this
      // catch just stops handleSubmit from falling through to the actions
      // above on an upload that never finished.
      if (!(err instanceof Error) || resumableUpload.status !== "error") {
        setError(err instanceof Error ? err.message : t("uploadFailed"));
      }
    }
  }

  const busy = resumableUpload.status === "uploading" || isPending;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        style={{
          background: "var(--navy-mid)",
          border: "1px dashed var(--border)",
          borderRadius: 16,
          padding: "16px 20px",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-muted)",
          cursor: "pointer",
          width: "100%",
          textAlign: "center",
        }}
      >
        {t("uploadContent")}
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ background: "var(--navy-mid)", border: "1px dashed var(--border)", borderRadius: 16, padding: 28 }}
    >
      <p style={{ fontSize: 15, color: "var(--text)", fontWeight: 600, marginBottom: 20 }}>{t("uploadContentHeader")}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 560 }}>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
            {t("contentKindLabel")}
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["document", "scorm"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setKind(option);
                  setFile(null);
                  setError(null);
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: 100,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: kind === option ? "1px solid var(--teal)" : "1px solid var(--border)",
                  background: kind === option ? "rgba(var(--teal-rgb),0.1)" : "transparent",
                  color: kind === option ? "var(--teal)" : "var(--text-muted)",
                }}
              >
                {option === "document" ? t("documentKindOption") : t("scormKindOption")}
              </button>
            ))}
          </div>
        </div>

        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("titlePlaceholder")}
          style={inputStyle}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("descriptionPlaceholder")}
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
            {t("fileLabel")}
          </label>
          <input
            type="file"
            accept={kind === "scorm" ? ".zip" : ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp4,.webm,.mov"}
            onChange={handleFileChange}
            style={{ fontSize: 13, color: "var(--text-muted)" }}
          />
          {file && <p style={{ fontSize: 12, color: "var(--teal)", marginTop: 4 }}>{file.name}</p>}
          {kind === "scorm" && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{t("scormHint")}</p>}
        </div>

        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
            {t("dueDateLabel")}
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            style={{ ...inputStyle, maxWidth: 200, colorScheme: "dark" }}
          />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={isNewHireContent}
            onChange={(e) => setIsNewHireContent(e.target.checked)}
            style={{ accentColor: "var(--teal)" }}
          />
          {t("newHireContentLabel")}
        </label>

        {courses.length > 0 && (
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
              {t("addToCourseLabel")}
            </label>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} style={{ ...inputStyle, maxWidth: 320 }}>
              <option value="">{t("noCourseOption")}</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {kind === "scorm" && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{t("scormCompletionExplainer")}</p>
        )}

        {kind === "document" && (
        <>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
            {t("howCompletedLabel")}
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["attestation", "exam"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setCompletionType(option)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 100,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: completionType === option ? "1px solid var(--teal)" : "1px solid var(--border)",
                  background: completionType === option ? "rgba(var(--teal-rgb),0.1)" : "transparent",
                  color: completionType === option ? "var(--teal)" : "var(--text-muted)",
                }}
              >
                {option === "attestation" ? t("confirmReadOption") : t("examOption")}
              </button>
            ))}
          </div>
        </div>

        {completionType === "exam" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                {t("passingScoreLabel")}
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={passingScore}
                onChange={(e) => setPassingScore(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
                style={{ ...inputStyle, maxWidth: 120 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                {t("maxAttemptsLabel")}
              </label>
              <input
                type="number"
                min={1}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value)}
                placeholder={t("unlimitedPlaceholder")}
                style={{ ...inputStyle, maxWidth: 120 }}
              />
            </div>

            {questions.map((q, qIndex) => (
              <div key={qIndex} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                    {t("questionN", { number: qIndex + 1 })}
                  </span>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuestion(qIndex)}
                      style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12, cursor: "pointer" }}
                    >
                      {t("remove")}
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={q.prompt}
                  onChange={(e) => updateQuestion(qIndex, { prompt: e.target.value })}
                  placeholder={t("questionPromptPlaceholder")}
                  style={{ ...inputStyle, marginBottom: 10 }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {q.options.map((opt, oIndex) => (
                    <div key={oIndex} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="radio"
                        name={`correct-${qIndex}`}
                        checked={q.correctIndex === oIndex}
                        onChange={() => updateQuestion(qIndex, { correctIndex: oIndex })}
                        aria-label={t("optionIsCorrect", { number: oIndex + 1 })}
                        style={{ accentColor: "var(--teal)" }}
                      />
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                        placeholder={t("optionPlaceholder", { number: oIndex + 1 })}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      {q.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(qIndex, oIndex)}
                          aria-label={t("removeOption")}
                          style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 16, cursor: "pointer" }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  {q.options.length < 6 && (
                    <button
                      type="button"
                      onClick={() => addOption(qIndex)}
                      style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--teal)", fontSize: 12, cursor: "pointer", marginTop: 4 }}
                    >
                      {t("addOption")}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addQuestion}
              style={{
                alignSelf: "flex-start",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text)",
                cursor: "pointer",
              }}
            >
              {t("addQuestion")}
            </button>
          </div>
        )}
        </>
        )}

        {resumableUpload.status === "uploading" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
              <span>{t("uploadingPercent", { percent: resumableUpload.progress })}</span>
              <button
                type="button"
                onClick={resumableUpload.cancel}
                style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                {t("cancelUpload")}
              </button>
            </div>
            <div style={{ height: 6, borderRadius: 100, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${resumableUpload.progress}%`, background: "var(--teal)", transition: "width 0.2s ease" }} />
            </div>
          </div>
        )}

        {resumableUpload.status === "error" && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <p style={{ color: "var(--danger)", fontSize: 13, flex: 1 }}>{resumableUpload.error ?? t("uploadFailed")}</p>
            <button
              type="button"
              onClick={resumableUpload.retry}
              style={{ background: "none", border: "1px solid var(--teal)", color: "var(--teal)", borderRadius: 8, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
            >
              {t("retryUpload")}
            </button>
          </div>
        )}

        {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}

        <div style={{ display: "flex", gap: 12 }}>
          <button
            type="submit"
            disabled={busy}
            style={{
              background: "var(--teal)",
              color: "#0A0F1E",
              border: "none",
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? t("uploading") : t("upload")}
          </button>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            disabled={busy}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </form>
  );
}
