"use client";

import { useEffect, useRef, useState } from "react";
import { noteIntegrityLeave } from "@/lib/integrity/actions";
import type { IntegrityKind } from "@/lib/integrity/core";

// Counts the times a person leaves the page (another tab or window) while an assessment is open, and how long they were away.
// Recorded when they come back. `ignore()` lets a screen's own dialogs (such as a confirm box) pass without counting.
export function useLeaveTracking(enabled: boolean, kind: IntegrityKind, subjectKey: string | null, startCount = 0) {
  const [count, setCount] = useState(startCount);
  const away = useRef<number | null>(null);
  const ignoring = useRef(false);

  useEffect(() => {
    if (!enabled || !subjectKey) return;
    const leave = () => {
      if (!ignoring.current && away.current === null) away.current = Date.now();
    };
    const back = () => {
      if (away.current === null || document.visibilityState !== "visible") return;
      const seconds = Math.round((Date.now() - away.current) / 1000);
      away.current = null;
      setCount((n) => n + 1);
      void noteIntegrityLeave(kind, subjectKey, seconds);
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
  }, [enabled, kind, subjectKey]);

  const ignore = (ms = 300) => {
    ignoring.current = true;
    away.current = null;
    setTimeout(() => {
      ignoring.current = false;
      away.current = null;
    }, ms);
  };
  return { count, ignore };
}
