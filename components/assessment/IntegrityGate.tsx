"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { beginIntegrity, finishIntegrity } from "@/lib/integrity/actions";
import { useLeaveTracking } from "@/components/assessment/useLeaveTracking";
import { formatClock, newTypingState, registerChange, remainingSeconds, typingSummary, type IntegrityKind, type IntegrityState, type TypingSummary } from "@/lib/integrity/core";

const card: React.CSSProperties = { background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 };
const primaryBtn: React.CSSProperties = { background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" };

export type GateApi = {
  // Seconds left (null before the page has mounted, or when there is no limit).
  remaining: number | null;
  timeUp: boolean;
  // Tell the gate a written answer changed length, so large insertions can be noticed.
  trackChange: (answerId: string, previousLength: number, nextLength: number) => void;
  // The sitting is over: record the finish and the typing summary. Safe to call when recording is not available.
  finish: () => Promise<void>;
  typing: () => TypingSummary;
};

// Wraps an assessment: the promise screen first, then a countdown bar, leave counting, and (for written answers) a check for text
// that arrives in large pieces. Everything is recorded through migration 0210; where that is not available the assessment simply
// runs without it. `hardExpiry`: when time is up the page calls onExpire (which should submit what exists); otherwise a notice says
// it will be noted next to the result.
export default function IntegrityGate({
  kind,
  subjectKey,
  timeLimitSeconds,
  initial,
  hardExpiry,
  onExpire,
  children,
}: {
  kind: IntegrityKind;
  subjectKey: string;
  timeLimitSeconds: number | null;
  initial: IntegrityState;
  hardExpiry: boolean;
  onExpire?: () => void;
  children: (api: GateApi) => ReactNode;
}) {
  const t = useTranslations("integrity");
  const [state, setState] = useState<IntegrityState>(initial);
  const [promised, setPromised] = useState(false);
  const [starting, setStarting] = useState(false);
  const [offset, setOffset] = useState(() => initial.serverNow - Date.now());
  const [remaining, setRemaining] = useState<number | null>(null);
  const [typingState] = useState(newTypingState);
  const expired = useRef(false);

  const row = state.row;
  const started = !state.available || !!row;
  const limit = row?.timeLimitSeconds ?? timeLimitSeconds;
  const startedAtMs = row ? Date.parse(row.startedAt) : null;

  useEffect(() => {
    if (!row || limit === null || startedAtMs === null) return;
    const tick = () => setRemaining(remainingSeconds(startedAtMs, limit, Date.now() + offset));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [row, limit, startedAtMs, offset]);

  const timeUp = remaining === 0;
  useEffect(() => {
    if (timeUp && hardExpiry && !expired.current) {
      expired.current = true;
      onExpire?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp]);

  const { count: leftCount } = useLeaveTracking(!!row && !row.finishedAt, kind, subjectKey, initial.row?.leftPage ?? 0);

  const trackChange = useCallback((id: string, prev: number, next: number) => registerChange(typingState, id, prev, next), [typingState]);
  const typing = useCallback(() => typingSummary(typingState), [typingState]);
  const finish = useCallback(async () => {
    if (state.available) await finishIntegrity(kind, subjectKey, typingSummary(typingState));
  }, [state.available, kind, subjectKey, typingState]);

  async function start() {
    setStarting(true);
    const next = await beginIntegrity(kind, subjectKey, timeLimitSeconds);
    setOffset(next.serverNow - Date.now());
    setState(next);
    setStarting(false);
  }

  if (!started) {
    const minutes = limit === null ? 0 : Math.round(limit / 60);
    return (
      <div style={card}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t("promiseTitle")}</h2>
        {limit !== null && <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6, marginTop: 10 }}>{t(hardExpiry ? "promiseHard" : "promiseSoft", { minutes })}</p>}
        <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 8 }}>{t("promiseRules")}</p>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 14, fontSize: 14, color: "var(--text)", lineHeight: 1.5, cursor: "pointer" }}>
          <input type="checkbox" checked={promised} onChange={(e) => setPromised(e.target.checked)} style={{ marginTop: 4 }} />
          <span>{t("promiseCheckbox")}</span>
        </label>
        <button type="button" style={{ ...primaryBtn, marginTop: 16, opacity: promised && !starting ? 1 : 0.5 }} disabled={!promised || starting} onClick={() => void start()}>
          {starting ? t("starting") : t("start")}
        </button>
      </div>
    );
  }

  const clock = remaining === null ? (limit === null ? null : formatClock(limit)) : formatClock(remaining);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {row && limit !== null && (
        <div
          role="timer"
          aria-label={clock ? t("timeLeft", { time: clock }) : undefined}
          style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: remaining !== null && remaining <= 60 ? "var(--danger)" : "var(--text)", fontVariantNumeric: "tabular-nums" }}>{clock ? t("timeLeft", { time: clock }) : ""}</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{leftCount > 0 ? t("leftPageSoFar", { count: leftCount }) : t("timedNote", { minutes: Math.round(limit / 60) })}</span>
        </div>
      )}
      {timeUp && <p role="status" style={{ fontSize: 13, color: "var(--amber)", margin: 0 }}>{t(hardExpiry ? "timeUpHard" : "timeUpSoft")}</p>}
      {children({ remaining, timeUp, trackChange, finish, typing })}
    </div>
  );
}
