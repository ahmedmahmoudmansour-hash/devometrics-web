"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { saveKnowledgeCheckAnswers, submitKnowledgeCheck } from "@/lib/knowledgeBank/actions";
import type { TakeView } from "@/lib/knowledgeBank/view";

const card: React.CSSProperties = { background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 };
const primaryBtn: React.CSSProperties = { background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const ghostBtn: React.CSSProperties = { background: "rgba(255,255,255,0.05)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" };

export default function KnowledgeCheckForm({ view }: { view: TakeView }) {
  const t = useTranslations("knowledgeCheck");
  const router = useRouter();
  const [choices, setChoices] = useState<Record<string, number | null>>(() => Object.fromEntries(view.questions.map((q) => [q.id, view.draft[q.id] ?? null])));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = view.questions.length;
  const answered = Object.values(choices).filter((c) => c !== null).length;
  const payload = () => view.questions.map((q) => ({ id: q.id, choice: choices[q.id] ?? null }));

  function save() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const r = await saveKnowledgeCheckAnswers(view.id, payload());
      if ("error" in r) setError(r.error);
      else setMessage(t("draftSaved"));
    });
  }

  function submit() {
    setError(null);
    setMessage(null);
    const missing = total - answered;
    if (missing > 0 && !window.confirm(t("confirmUnanswered", { count: missing }))) return;
    startTransition(async () => {
      const r = await submitKnowledgeCheck(view.id, payload());
      if ("error" in r) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div dir={view.language === "ar" ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", margin: 0 }}>{view.roleTitle}</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6 }}>{t("takeIntro")}</p>
        <p role="status" aria-live="polite" style={{ fontSize: 12, color: "var(--teal)", fontWeight: 700, marginTop: 8 }}>
          {t("answeredOf", { answered, total })}
        </p>
      </div>

      {view.questions.map((q, i) => (
        <fieldset key={q.id} style={{ ...card, margin: 0 }} aria-labelledby={`q-${q.id}`}>
          <legend style={{ padding: 0 }} />
          <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
            {t("questionOf", { n: i + 1, total })} · {q.competencyName}
          </p>
          <p id={`q-${q.id}`} style={{ fontSize: 15, color: "var(--text)", fontWeight: 600, lineHeight: 1.55, margin: "8px 0 12px" }}>
            {q.stem}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {q.options.map((o, idx) => {
              const on = choices[q.id] === idx;
              return (
                <label
                  key={idx}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    cursor: "pointer",
                    border: `1px solid ${on ? "var(--teal)" : "var(--border)"}`,
                    background: on ? "rgba(var(--teal-rgb),0.08)" : "transparent",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 14,
                    color: "var(--text)",
                    lineHeight: 1.5,
                  }}
                >
                  <input type="radio" name={q.id} checked={on} onChange={() => setChoices((p) => ({ ...p, [q.id]: idx }))} style={{ marginTop: 4 }} />
                  <span>{o}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" style={{ ...primaryBtn, opacity: pending ? 0.6 : 1 }} disabled={pending} onClick={submit}>
          {pending ? t("submitting") : t("submit")}
        </button>
        <button type="button" style={{ ...ghostBtn, opacity: pending ? 0.6 : 1 }} disabled={pending} onClick={save}>
          {t("saveDraft")}
        </button>
      </div>
      {message && (
        <p role="status" style={{ color: "var(--teal)", fontSize: 13, margin: 0 }}>
          {message}
        </p>
      )}
      {error && (
        <p role="alert" style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  );
}
