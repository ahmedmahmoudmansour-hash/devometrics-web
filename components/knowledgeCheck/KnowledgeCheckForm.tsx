"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { noteKnowledgeCheckLeftPage, saveKnowledgeCheckAnswers, submitKnowledgeCheck } from "@/lib/knowledgeBank/actions";
import { formatClock, remainingSeconds } from "@/lib/knowledgeBank/timer";
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

  // ---- the clock. The server says when it started; the person's own clock is only used for the difference since the page
  // loaded. Shown after the page mounts, so the server-rendered and browser-rendered text cannot disagree.
  const [offset] = useState(() => view.timer.serverNow - Date.now());
  const [startedAtMs] = useState(() => view.timer.startedAt ?? Date.now() + offset);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [leftCount, setLeftCount] = useState(view.timer.leftPage);
  const ignoreAway = useRef(false);
  const away = useRef(false);
  const autoSubmitted = useRef(false);
  const limit = view.timer.limitSeconds;

  useEffect(() => {
    const tick = () => setRemaining(remainingSeconds(startedAtMs, limit, Date.now() + offset));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAtMs, limit, offset]);

  // Leaving the page (another tab or window) is counted when the person comes back, and shown to the manager.
  useEffect(() => {
    const leave = () => {
      if (!ignoreAway.current) away.current = true;
    };
    const back = () => {
      if (!away.current || document.visibilityState !== "visible") return;
      away.current = false;
      setLeftCount((n) => n + 1);
      void noteKnowledgeCheckLeftPage(view.id);
    };
    const onVisibility = () => (document.visibilityState === "hidden" ? leave() : back());
    window.addEventListener("blur", leave);
    window.addEventListener("focus", back);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", leave);
      window.removeEventListener("focus", back);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [view.id]);

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

  function submit(timeUp = false) {
    setError(null);
    setMessage(timeUp ? t("timeUp") : null);
    const missing = total - answered;
    if (!timeUp && missing > 0) {
      // The confirm box takes focus from the page; that must not count as leaving it.
      ignoreAway.current = true;
      const ok = window.confirm(t("confirmUnanswered", { count: missing }));
      setTimeout(() => {
        ignoreAway.current = false;
        away.current = false;
      }, 300);
      if (!ok) return;
    }
    startTransition(async () => {
      const r = await submitKnowledgeCheck(view.id, payload());
      if ("error" in r) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  // When the time is up the check submits itself with whatever has been answered.
  useEffect(() => {
    if (remaining === 0 && !autoSubmitted.current) {
      autoSubmitted.current = true;
      submit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  return (
    <div dir={view.language === "ar" ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        role="timer"
        aria-label={t("timeLeft", { time: remaining === null ? formatClock(limit) : formatClock(remaining) })}
        style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: remaining !== null && remaining <= 60 ? "var(--danger)" : "var(--text)", fontVariantNumeric: "tabular-nums" }}>
          {t("timeLeft", { time: remaining === null ? formatClock(limit) : formatClock(remaining) })}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{leftCount > 0 ? t("leftPageSoFar", { count: leftCount }) : t("timedNote", { minutes: Math.round(limit / 60) })}</span>
      </div>
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
        <button type="button" style={{ ...primaryBtn, opacity: pending ? 0.6 : 1 }} disabled={pending} onClick={() => submit()}>
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
