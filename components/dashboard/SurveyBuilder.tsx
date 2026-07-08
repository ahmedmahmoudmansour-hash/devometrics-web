"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSurvey, previewSurveyQuestions } from "@/lib/surveys/actions";
import { SURVEY_THEMES, type SurveyQuestion, type SurveyQuestionType } from "@/lib/surveys/types";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13,
  color: "var(--text)",
  outline: "none",
};

const smallButton: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-muted)",
  cursor: "pointer",
};

let nextManualId = 1;

function QuestionEditor({
  question,
  onChange,
  onRemove,
}: {
  question: SurveyQuestion;
  onChange: (q: SurveyQuestion) => void;
  onRemove: () => void;
}) {
  function updateOption(index: number, value: string) {
    const options = [...(question.options ?? [])];
    options[index] = value;
    onChange({ ...question, options });
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={question.text}
          onChange={(e) => onChange({ ...question, text: e.target.value })}
          placeholder="Question text"
          style={{ ...inputStyle, flex: "1 1 240px" }}
        />
        <select
          value={question.type}
          onChange={(e) => onChange({ ...question, type: e.target.value as SurveyQuestionType })}
          style={{ ...inputStyle, flex: "0 1 160px", cursor: "pointer" }}
        >
          <option value="rating">Rating (1-5)</option>
          <option value="multiple_choice">Multiple choice</option>
          <option value="qualitative">Open-ended</option>
        </select>
      </div>
      {question.type === "multiple_choice" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(question.options ?? ["", ""]).map((opt, i) => (
            <input
              key={i}
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
              style={inputStyle}
            />
          ))}
          <button
            type="button"
            onClick={() => onChange({ ...question, options: [...(question.options ?? []), ""] })}
            style={{ ...smallButton, alignSelf: "flex-start" }}
          >
            + Add option
          </button>
        </div>
      )}
      <button type="button" onClick={onRemove} style={{ ...smallButton, alignSelf: "flex-start" }}>
        Remove question
      </button>
    </div>
  );
}

export default function SurveyBuilder({ employees }: { employees: { userId: string; name: string }[] }) {
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState<string>(SURVEY_THEMES[0]);
  const [focus, setFocus] = useState("");
  const [questions, setQuestions] = useState<SurveyQuestion[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isGenerating, startGenerate] = useTransition();
  const [isPublishing, startPublish] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ questionCount: number } | null>(null);
  const router = useRouter();

  function toggleEmployee(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(employees.map((e) => e.userId)));
  }

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startGenerate(async () => {
      const result = await previewSurveyQuestions(theme, focus);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setQuestions(result.questions);
    });
  }

  function updateQuestion(index: number, q: SurveyQuestion) {
    setQuestions((prev) => (prev ? prev.map((existing, i) => (i === index ? q : existing)) : prev));
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  }

  function addBlankQuestion() {
    setQuestions((prev) => [
      ...(prev ?? []),
      { id: `manual-${nextManualId++}`, text: "", type: "rating" },
    ]);
  }

  function handlePublish() {
    if (!questions) return;
    setError(null);
    startPublish(async () => {
      const result = await createSurvey({
        title,
        theme,
        questions,
        employeeUserIds: [...selected],
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSuccess({ questionCount: result?.questionCount ?? 0 });
      setTitle("");
      setFocus("");
      setQuestions(null);
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Create a survey</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 18, lineHeight: 1.6 }}>
        AI drafts a mix of rating, multiple-choice, and open-ended questions from the theme you pick —
        review and edit them before assigning. Results only ever show as anonymous aggregates once at
        least 3 people have responded — never who said what.
      </p>

      {success && (
        <div
          style={{
            background: "rgba(0,201,167,0.06)",
            border: "1px solid rgba(0,201,167,0.25)",
            borderRadius: 10,
            padding: 14,
            marginBottom: 16,
            fontSize: 13,
            color: "var(--teal)",
          }}
        >
          Survey created with {success.questionCount} questions and assigned.
        </div>
      )}
      {error && <p style={{ color: "#f87171", fontSize: 12, marginBottom: 12 }}>{error}</p>}

      <form onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: questions ? 20 : 0 }}>
        <div>
          <label htmlFor="survey-title" style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
            Title
          </label>
          <input
            id="survey-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q3 Culture Pulse Check"
            required
            style={inputStyle}
          />
        </div>

        <div>
          <label htmlFor="survey-theme" style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
            Theme
          </label>
          <select id="survey-theme" value={theme} onChange={(e) => setTheme(e.target.value)} style={inputStyle}>
            {SURVEY_THEMES.map((t) => (
              <option key={t} value={t} style={{ color: "#000" }}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="survey-focus" style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
            Anything specific you want it to probe? (optional)
          </label>
          <textarea
            id="survey-focus"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="e.g. how the recent reorg has affected morale"
            rows={2}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>

        <button
          type="submit"
          disabled={isGenerating}
          style={{
            alignSelf: "flex-start",
            background: questions ? "transparent" : "var(--teal)",
            border: questions ? "1px solid var(--border)" : "none",
            color: questions ? "var(--text-muted)" : "#0A0F1E",
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            opacity: isGenerating ? 0.6 : 1,
          }}
        >
          {isGenerating ? "Generating questions…" : questions ? "Regenerate questions" : "Generate questions"}
        </button>
      </form>

      {questions && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>
              Questions ({questions.length}) — edit, remove, or add your own
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {questions.map((q, i) => (
                <QuestionEditor
                  key={q.id}
                  question={q}
                  onChange={(next) => updateQuestion(i, next)}
                  onRemove={() => removeQuestion(i)}
                />
              ))}
            </div>
            <button type="button" onClick={addBlankQuestion} style={{ ...smallButton, marginTop: 10 }}>
              + Add your own question
            </button>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Assign to ({selected.size} selected)
              </label>
              <button type="button" onClick={selectAll} style={{ background: "none", border: "none", color: "var(--teal)", fontSize: 12, cursor: "pointer" }}>
                Select all
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 160, overflowY: "auto" }}>
              {employees.map((emp) => {
                const checked = selected.has(emp.userId);
                return (
                  <button
                    key={emp.userId}
                    type="button"
                    onClick={() => toggleEmployee(emp.userId)}
                    aria-pressed={checked}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 100,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: checked ? "1px solid rgba(0,201,167,0.4)" : "1px solid var(--border)",
                      background: checked ? "rgba(0,201,167,0.12)" : "rgba(255,255,255,0.05)",
                      color: checked ? "var(--teal)" : "var(--text-muted)",
                    }}
                  >
                    {emp.name}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={handlePublish}
            disabled={isPublishing}
            style={{
              alignSelf: "flex-start",
              background: "var(--teal)",
              color: "#0A0F1E",
              border: "none",
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              opacity: isPublishing ? 0.6 : 1,
            }}
          >
            {isPublishing ? "Publishing…" : "Publish & assign"}
          </button>
        </div>
      )}
    </div>
  );
}
