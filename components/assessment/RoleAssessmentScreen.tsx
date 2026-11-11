"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import PrintReportBar from "@/components/assessment/PrintReportBar";
import { confirmRoleResult, saveRoleAssessmentAnswers, scoreRoleAssessmentCompetency, submitRoleAssessment } from "@/lib/assessment/actions";
import { gapAgainstRange } from "@/lib/assessment/scoring";
import type { CompetencyEntry, RoleAssessmentView } from "@/lib/assessment/types";

const card: React.CSSProperties = { background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 };
const muted: React.CSSProperties = { fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 };
const primaryBtn: React.CSSProperties = { background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const ghostBtn: React.CSSProperties = { background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, cursor: "pointer" };

function useWords() {
  return (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
}

function LevelPill({ level }: { level: number }) {
  const t = useTranslations("proficiency");
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--teal)", background: "rgba(var(--teal-rgb),0.1)", border: "1px solid rgba(var(--teal-rgb),0.3)", borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" }}>
      {t("levelShort", { level })} · {t(`level${level}`)}
    </span>
  );
}

export default function RoleAssessmentScreen({ view }: { view: RoleAssessmentView }) {
  const t = useTranslations("roleAssessment");
  const router = useRouter();
  const words = useWords();
  const isEmployee = view.viewer === "employee";
  const open = view.status === "assigned" || view.status === "in_progress";

  const [answers, setAnswers] = useState<Record<string, string>>(() => Object.fromEntries(view.entries.flatMap((e) => e.items.map((i) => [i.itemId, i.answer ?? ""]))));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasteBlocked, setPasteBlocked] = useState(false);
  const format = useFormatter();
  const tReport = useTranslations("assessmentReport");
  const [isPending, startTransition] = useTransition();

  const allItems = view.entries.flatMap((e) => e.items);
  const payload = () => allItems.map((i) => ({ itemId: i.itemId, text: answers[i.itemId] ?? "" }));

  function saveDraft() {
    setError(null);
    setMessage(t("saving"));
    startTransition(async () => {
      const r = await saveRoleAssessmentAnswers(view.id, payload());
      if ("error" in r && r.error) { setMessage(null); setError(r.error); return; }
      setMessage(t("draftSaved"));
    });
  }
  function submit() {
    if (!window.confirm(t("submitConfirm"))) return;
    setError(null);
    startTransition(async () => {
      const r = await submitRoleAssessment(view.id, payload());
      if ("error" in r && r.error) { setError(r.error); return; }
      router.refresh();
    });
  }

  // ---- scoring runner: scores each competency that has no usable result yet, a few at a time, with visible progress
  const toScore = view.entries.filter((e) => !e.result || e.result.status === "scoring_failed");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const started = useRef(false);
  const canScore = view.status !== "assigned" && view.status !== "in_progress";

  async function runScoring(list: CompetencyEntry[]) {
    setScoreError(null);
    setProgress({ done: 0, total: list.length });
    let done = 0;
    const queue = [...list];
    const worker = async () => {
      while (queue.length) {
        const entry = queue.shift()!;
        const r = await scoreRoleAssessmentCompetency(view.id, entry.versionId);
        if ("error" in r && r.error) setScoreError(r.error);
        done += 1;
        setProgress({ done, total: list.length });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setProgress(null);
    router.refresh();
  }
  // Start scoring as soon as the assessment is submitted, whether the person just pressed Submit (the status changes
  // under this component) or comes back to a submitted assessment later.
  useEffect(() => {
    if (canScore && isEmployee && toScore.length > 0 && !started.current) {
      started.current = true;
      void runScoring(toScore);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canScore, view.status]);

  const failed = view.entries.filter((e) => e.result?.status === "scoring_failed");

  const hasResults = canScore && view.entries.some((e) => e.result);
  const reportDate = view.scoredAt ?? view.submittedAt;

  return (
    <div className="print-plan" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {hasResults && <PrintReportBar />}
      <div style={card}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>{view.roleTitle}</h1>
        {!isEmployee && view.employeeName && <p style={{ ...muted, marginTop: 4 }}>{t("forEmployee", { name: view.employeeName })}</p>}
        {hasResults && reportDate && <p style={{ ...muted, marginTop: 4 }}>{tReport("roleReportLine", { date: format.dateTime(new Date(reportDate), { dateStyle: "long" }), level: view.roleLevel })}</p>}
        <p style={{ ...muted, marginTop: 8 }}>{t("intro")}</p>
        <p style={{ ...muted, marginTop: 6, color: "var(--teal)" }}>{t("pilotNote")}</p>
      </div>

      {/* ---- answering */}
      {open && isEmployee && (
        <div className="no-print" style={{ display: "contents" }}>
          <p style={muted}>{t("answerHint")}</p>
          {pasteBlocked && <p role="status" style={{ ...muted, color: "var(--amber)" }}>{t("noPaste")}</p>}
          {view.entries.map((e) => (
            <div key={e.versionId} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>{e.name}</h2>
                {e.requiredLevel && <span style={muted}>{t("requiredLevel")} <LevelPill level={e.requiredLevel} /></span>}
              </div>
              {e.description && <p style={{ ...muted, marginTop: 4 }}>{e.description}</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 14 }}>
                {e.items.map((i) => (
                  <div key={i.itemId}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>{t("questionN", { n: i.position })}</p>
                    <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6, margin: "0 0 8px" }}>{i.prompt}</p>
                    <textarea
                      value={answers[i.itemId] ?? ""}
                      onChange={(ev) => setAnswers((p) => ({ ...p, [i.itemId]: ev.target.value }))}
                      onPaste={(ev) => {
                        ev.preventDefault();
                        setPasteBlocked(true);
                      }}
                      onDrop={(ev) => ev.preventDefault()}
                      rows={5}
                      maxLength={6000}
                      placeholder={t("answerPlaceholder")}
                      style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 14px", fontSize: 14, color: "var(--text)", outline: "none", resize: "vertical" }}
                    />
                    <p style={{ ...muted, marginTop: 4 }}>{t("wordCount", { count: words(answers[i.itemId] ?? "") })}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" style={ghostBtn} disabled={isPending} onClick={saveDraft}>{t("saveDraft")}</button>
            <button type="button" style={{ ...primaryBtn, opacity: isPending ? 0.6 : 1 }} disabled={isPending} onClick={submit}>{isPending ? t("submitting") : t("submit")}</button>
            {message && <span style={muted}>{message}</span>}
          </div>
        </div>
      )}

      {open && !isEmployee && <p style={muted}>{t("notSubmittedYet")}</p>}

      {/* ---- scoring */}
      {canScore && progress && (
        <div className="no-print" style={card}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t("scoringProgress", progress)}</p>
          <p style={{ ...muted, marginTop: 4 }}>{t("scoringWait")}</p>
        </div>
      )}
      {canScore && !progress && toScore.length > 0 && (
        <div className="no-print" style={{ ...card, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <p style={{ ...muted, margin: 0 }}>{failed.length > 0 ? t("scoringFailedHint") : t("pendingScoring")}</p>
          <button type="button" style={primaryBtn} onClick={() => void runScoring(toScore)}>{failed.length > 0 ? t("retryFailed") : t("scoreNow")}</button>
        </div>
      )}
      {scoreError && <p style={{ color: "var(--danger)", fontSize: 13 }}>{scoreError}</p>}

      {/* ---- results */}
      {canScore &&
        view.entries.map((e) => <ResultCard key={e.versionId} entry={e} view={view} />)}
      {canScore && view.entries.some((e) => e.result) && <p style={muted}>{t("estimateNote")}</p>}
    </div>
  );
}

function ResultCard({ entry, view }: { entry: CompetencyEntry; view: RoleAssessmentView }) {
  const t = useTranslations("roleAssessment");
  const router = useRouter();
  const r = entry.result;
  const [showAnswers, setShowAnswers] = useState(false);
  const [override, setOverride] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const canConfirm = view.viewer !== "employee";

  const scored = r && r.status === "scored" && r.level && r.rangeLow && r.rangeHigh;
  const gap = scored
    ? gapAgainstRange(entry.requiredLevel, { status: "scored", level: r.level as 1 | 2 | 3 | 4 | 5, rangeLow: r.rangeLow as 1 | 2 | 3 | 4 | 5, rangeHigh: r.rangeHigh as 1 | 2 | 3 | 4 | 5, score: r.score ?? 0, scoreLow: r.scoreLow ?? 0, scoreHigh: r.scoreHigh ?? 0, evidence: [] })
    : null;

  function confirm(withOverride: boolean) {
    setErr(null);
    startTransition(async () => {
      const res = await confirmRoleResult(r!.id, withOverride ? { overrideLevel: override === "" ? null : Number(override), reason } : {});
      if ("error" in res && res.error) { setErr(res.error); return; }
      router.refresh();
    });
  }

  return (
    <div className="print-avoid-break" style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>{entry.name}</h2>
        {entry.requiredLevel && (
          <span style={muted}>
            {t("requiredLevel")} <LevelPill level={entry.requiredLevel} />
          </span>
        )}
      </div>

      {!r && <p style={{ ...muted, marginTop: 10 }}>{t("pendingScoring")}</p>}

      {r?.status === "scoring_failed" && (
        <p style={{ marginTop: 10, fontSize: 13, color: "var(--danger)" }}>{t("scoringFailed")}. {t("scoringFailedHint")}</p>
      )}

      {r?.status === "not_assessed" && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t("notAssessed")} · {t("assessmentNeeded")}</p>
          {r.notAssessedReason && <p style={{ ...muted, marginTop: 4 }}>{t(`reason_${r.notAssessedReason}`)}</p>}
        </div>
      )}

      {scored && r && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={muted}>{t("demonstrated")}</span>
            {r.rangeLow === r.rangeHigh ? <LevelPill level={r.level!} /> : <span style={{ fontSize: 12, fontWeight: 700, color: "var(--teal)" }}>{t("levelRange", { low: r.rangeLow!, high: r.rangeHigh! })}</span>}
            <span style={muted}>{r.scoreLow !== null && r.scoreHigh !== null && r.scoreLow !== r.scoreHigh ? t("scoreRange", { low: r.scoreLow, high: r.scoreHigh }) : t("scoreOne", { score: r.score ?? 0 })}</span>
            {r.confidence && <span style={muted}>{t("confidence")}: {t(`confidence_${r.confidence}`)}</span>}
          </div>
          {gap && gap.kind !== "none" ? (
            <p style={{ fontSize: 13, color: gap.kind === "close" ? "var(--text)" : "var(--danger)", margin: 0 }}>{gap.kind === "close" ? t("gap_close") : t("gap_gap", { count: gap.atLeastLevels })}</p>
          ) : gap ? (
            <p style={{ fontSize: 13, color: "var(--teal)", margin: 0 }}>{t("gap_none")}</p>
          ) : null}
          {r.confidenceReasons.length > 0 && (
            <p style={muted}>{r.confidenceReasons.filter((x) => x !== "too_few_answers").map((x) => t(`reason_${x}`)).join(" · ")}</p>
          )}
          {r.evidenceQuotes.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>{t("evidence")}</p>
              <ul style={{ margin: 0, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                {r.evidenceQuotes.filter((q) => q.level === r.level || q.shown === 2).slice(0, 4).map((q, idx) => (
                  <li key={idx} style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>
                    “{q.quote}”
                  </li>
                ))}
              </ul>
            </div>
          )}
          {r.nextLevelGap && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>{t("nextLevel")}</p>
              <p style={{ fontSize: 13, color: "var(--text)", margin: 0, lineHeight: 1.5 }}>{r.nextLevelGap}</p>
            </div>
          )}
        </div>
      )}

      {r && r.status === "scored" && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
          {r.confirmedAt ? (
            <p style={{ ...muted, margin: 0, color: "var(--teal)" }}>{r.overrideLevel ? t("adjustedTo", { level: r.overrideLevel, reason: r.overrideReason ?? "" }) : t("confirmedBy")}</p>
          ) : (
            <p style={{ ...muted, margin: 0 }}>{t("awaitingConfirmation")}</p>
          )}
          {canConfirm && !r.confirmedAt && (
            <div className="no-print" style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button type="button" style={primaryBtn} disabled={pending} onClick={() => confirm(false)}>{t("confirm")}</button>
                <span style={muted}>{t("changeLevel")}:</span>
                <select value={override} onChange={(e) => setOverride(e.target.value === "" ? "" : Number(e.target.value))} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", padding: "6px 8px" }} aria-label={t("levelLabel")}>
                  <option value="">{t("levelLabel")}</option>
                  {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reasonLabel")} style={{ flex: 1, minWidth: 160, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", padding: "6px 10px" }} />
                <button type="button" style={ghostBtn} disabled={pending || override === "" || !reason.trim()} onClick={() => confirm(true)}>{t("applyChange")}</button>
              </div>
              {err && <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>{err}</p>}
            </div>
          )}
        </div>
      )}

      {canConfirm && entry.items.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <button type="button" className="no-print" style={{ background: "none", border: "none", color: "var(--teal)", fontSize: 12, cursor: "pointer", padding: 0 }} onClick={() => setShowAnswers((v) => !v)}>
            {showAnswers ? t("hideAnswers") : t("showAnswers")}
          </button>
          {showAnswers && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
              {entry.items.map((i) => (
                <div key={i.itemId}>
                  <p style={{ ...muted, margin: 0 }}>{t("questionN", { n: i.position })}: {i.prompt}</p>
                  <p style={{ fontSize: 13, color: "var(--text)", margin: "2px 0 0", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{i.purged ? t("answersPurged") : i.answer?.trim() || t("noAnswer")}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
