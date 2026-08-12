"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { createKnowledgeHubContent } from "@/lib/knowledgeHub/actions";
import { KNOWLEDGE_HUB_BUCKET, KNOWLEDGE_HUB_MAX_BYTES, KNOWLEDGE_HUB_ALLOWED_MIME_TYPES } from "@/lib/knowledgeHub/constants";
import type { KnowledgeHubCompletionType } from "@/lib/supabase/types";

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

export default function KnowledgeHubUploadForm({ organizationId }: { organizationId: string }) {
  const t = useTranslations("knowledgeHubUploadForm");
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [completionType, setCompletionType] = useState<KnowledgeHubCompletionType>("attestation");
  const [passingScore, setPassingScore] = useState(80);
  const [maxAttempts, setMaxAttempts] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [isNewHireContent, setIsNewHireContent] = useState(false);
  const [questions, setQuestions] = useState<DraftQuestion[]>([newQuestion()]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (!(KNOWLEDGE_HUB_ALLOWED_MIME_TYPES as readonly string[]).includes(f.type)) {
      setError(t("onlyDocsSupported"));
      return;
    }
    if (f.size > KNOWLEDGE_HUB_MAX_BYTES) {
      setError(t("fileTooLarge"));
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
    if (completionType === "exam") {
      for (const q of questions) {
        if (!q.prompt.trim()) return setError(t("everyQuestionNeedsPrompt"));
        if (q.options.some((o) => !o.trim())) return setError(t("everyOptionNeedsText"));
      }
    }

    setUploading(true);
    try {
      const contentId = crypto.randomUUID();
      const storagePath = `${organizationId}/${contentId}/${sanitizeFileName(file.name)}`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage.from(KNOWLEDGE_HUB_BUCKET).upload(storagePath, file);
      if (uploadError) throw new Error(uploadError.message);

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
        });
        if (result?.error) {
          setError(result.error);
          return;
        }
        setTitle("");
        setDescription("");
        setFile(null);
        setCompletionType("attestation");
        setMaxAttempts("");
        setDueDate("");
        setIsNewHireContent(false);
        setQuestions([newQuestion()]);
        setExpanded(false);
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  const busy = uploading || isPending;

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
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp4,.webm,.mov"
            onChange={handleFileChange}
            style={{ fontSize: 13, color: "var(--text-muted)" }}
          />
          {file && <p style={{ fontSize: 12, color: "var(--teal)", marginTop: 4 }}>{file.name}</p>}
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
