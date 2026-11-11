"use client";

import { useTranslations } from "next-intl";
import type { ResultView } from "@/lib/knowledgeBank/view";
import { formatClock } from "@/lib/knowledgeBank/timer";

const card: React.CSSProperties = { background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 };

export default function KnowledgeCheckResult({ view, employeeName }: { view: ResultView; employeeName: string | null }) {
  const t = useTranslations("knowledgeCheck");
  const tone = view.reading === "strong" ? "var(--teal)" : view.reading === "adequate" ? "var(--amber)" : "var(--danger)";

  return (
    <div dir={view.language === "ar" ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", margin: 0 }}>{employeeName ? t("resultTitleFor", { name: employeeName }) : t("resultTitle")}</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>{view.roleTitle}</p>
      </div>

      <div style={{ ...card, display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 44, fontWeight: 800, color: tone, fontVariantNumeric: "tabular-nums" }}>{t("score", { percent: view.percent })}</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{t(`reading_${view.reading}`)}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{t("scoreOf", { correct: view.correct, asked: view.asked })}</div>
        </div>
      </div>

      {view.timing && (
        <p style={{ fontSize: 12, color: view.timing.late ? "var(--amber)" : "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
          {t("timingResult", { used: formatClock(view.timing.usedSeconds), limit: formatClock(view.timing.limitSeconds) })} · {t("leftPageResult", { count: view.timing.leftPage })}
          {view.timing.late ? ` · ${t("submittedLate")}` : ""}
        </p>
      )}
      <p style={{ fontSize: 12, color: "var(--amber)", lineHeight: 1.6, margin: 0 }}>{t("caution")}</p>

      <div style={card}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t("byCompetency")}</h2>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {view.perCompetency.map((p) => (
            <div key={p.competencyKey} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
              <span style={{ color: "var(--text)" }}>
                {p.competencyName}
                {p.requiredLevel > 0 && <span style={{ color: "var(--text-muted)", marginInlineStart: 8, fontSize: 12 }}>{t("levelNeeded", { n: p.requiredLevel })}</span>}
              </span>
              <span style={{ color: p.correct === p.asked ? "var(--teal)" : "var(--text-muted)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{t("correctOf", { correct: p.correct, asked: p.asked })}</span>
            </div>
          ))}
        </div>
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: "4px 0 0" }}>{t("reviewTitle")}</h2>
      {view.review.map((q) => {
        const right = q.chosen === q.correct;
        return (
          <div key={q.id} style={card}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>{q.competencyName}</p>
            <p style={{ fontSize: 15, color: "var(--text)", fontWeight: 600, lineHeight: 1.55, margin: "6px 0 10px" }}>{q.stem}</p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {q.options.map((o, i) => {
                const isRight = i === q.correct;
                const isChosen = i === q.chosen;
                return (
                  <li
                    key={i}
                    style={{
                      border: `1px solid ${isRight ? "var(--teal)" : isChosen ? "var(--danger)" : "var(--border)"}`,
                      background: isRight ? "rgba(var(--teal-rgb),0.08)" : "transparent",
                      borderRadius: 10,
                      padding: "8px 12px",
                      fontSize: 13.5,
                      color: "var(--text)",
                      lineHeight: 1.5,
                    }}
                  >
                    {o}
                    {isRight && <strong style={{ color: "var(--teal)", marginInlineStart: 8, fontSize: 12 }}>{t("rightAnswer")}</strong>}
                    {isChosen && !isRight && <strong style={{ color: "var(--danger)", marginInlineStart: 8, fontSize: 12 }}>{t("yourAnswer")}</strong>}
                    {isChosen && isRight && <strong style={{ color: "var(--teal)", marginInlineStart: 8, fontSize: 12 }}>· {t("yourAnswer")}</strong>}
                  </li>
                );
              })}
            </ul>
            <p style={{ fontSize: 12.5, marginTop: 10, color: "var(--text-muted)", lineHeight: 1.55 }}>
              <strong style={{ color: right ? "var(--teal)" : q.chosen === null ? "var(--text-muted)" : "var(--danger)" }}>{q.chosen === null ? t("notAnswered") : right ? t("markedCorrect") : t("markedWrong")}.</strong> {t("whyLabel")}: {q.why}
            </p>
          </div>
        );
      })}
      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("version", { version: view.bankVersion })}</p>
    </div>
  );
}
