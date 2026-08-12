"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createExitInterview } from "@/lib/exitInterviews/actions";
import { EXIT_INTERVIEW_QUESTIONS } from "@/lib/exitInterviews/questions";
import type { SeparationType } from "@/lib/exitInterviews/types";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13,
  color: "var(--text)",
  outline: "none",
  fontFamily: "inherit",
};
const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: 6,
  display: "block",
};

export default function ExitInterviewForm() {
  const t = useTranslations("exitInterviewsPage");
  const translatedQuestions = t.raw("questions") as string[];
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [employeeName, setEmployeeName] = useState("");
  const [department, setDepartment] = useState("");
  const [title, setTitle] = useState("");
  const [managerName, setManagerName] = useState("");
  const [lastDay, setLastDay] = useState("");
  const [separationType, setSeparationType] = useState<SeparationType>("voluntary");
  const [answers, setAnswers] = useState<string[]>(EXIT_INTERVIEW_QUESTIONS.map(() => ""));
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setEmployeeName("");
    setDepartment("");
    setTitle("");
    setManagerName("");
    setLastDay("");
    setSeparationType("voluntary");
    setAnswers(EXIT_INTERVIEW_QUESTIONS.map(() => ""));
    setAdditionalNotes("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createExitInterview({
        employeeName,
        department,
        title,
        managerName,
        lastDay,
        separationType,
        answers,
        additionalNotes,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      reset();
      setExpanded(false);
      router.refresh();
    });
  }

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
          marginBottom: 24,
        }}
      >
        {t("recordButton")}
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{ background: "var(--navy-mid)", border: "1px dashed var(--border)", borderRadius: 16, padding: 28, marginBottom: 24 }}>
      <p style={{ fontSize: 15, color: "var(--text)", fontWeight: 600, marginBottom: 20 }}>{t("recordFormHeader")}</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 20 }}>
        <div>
          <label style={labelStyle}>{t("employeeNameLabel")}</label>
          <input style={inputStyle} value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} required />
        </div>
        <div>
          <label style={labelStyle}>{t("departmentLabel")}</label>
          <input style={inputStyle} value={department} onChange={(e) => setDepartment(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>{t("titleLabel")}</label>
          <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>{t("managerNameLabel")}</label>
          <input style={inputStyle} value={managerName} onChange={(e) => setManagerName(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>{t("lastDayLabel")}</label>
          <input type="date" style={{ ...inputStyle, colorScheme: "dark" }} value={lastDay} onChange={(e) => setLastDay(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>{t("separationTypeLabel")}</label>
          <select style={{ ...inputStyle, cursor: "pointer" }} value={separationType} onChange={(e) => setSeparationType(e.target.value as SeparationType)}>
            <option value="voluntary">{t("separationVoluntary")}</option>
            <option value="involuntary">{t("separationInvoluntary")}</option>
            <option value="other">{t("separationOther")}</option>
          </select>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
        {EXIT_INTERVIEW_QUESTIONS.map((_, i) => (
          <div key={i}>
            <label style={labelStyle}>{translatedQuestions[i]}</label>
            <textarea
              value={answers[i]}
              onChange={(e) => setAnswers((prev) => prev.map((a, idx) => (idx === i ? e.target.value : a)))}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
        ))}
        <div>
          <label style={labelStyle}>{t("additionalNotesLabel")}</label>
          <textarea value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
      </div>

      {error && <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <div style={{ display: "flex", gap: 12 }}>
        <button
          type="submit"
          disabled={isPending}
          style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
        >
          {isPending ? t("saving") : t("saveButton")}
        </button>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          disabled={isPending}
          style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}
        >
          {t("cancelButton")}
        </button>
      </div>
    </form>
  );
}
