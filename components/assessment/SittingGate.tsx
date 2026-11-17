"use client";

import { useState, type ReactNode } from "react";
import IntegrityGate from "@/components/assessment/IntegrityGate";
import { testTimeLimit } from "@/lib/integrity/core";

// For tests that have no row of their own (cognitive reasoning, English proficiency): each sitting gets its own id, kept for the
// browser session so a reload resumes the same sitting and its clock, and dropped once the test is finished. The time limit is
// soft here: those tests only accept a complete set of answers, so going over is noted next to the result rather than cutting the
// person off.
export default function SittingGate({
  kind,
  slug,
  questionCount,
  serverNow,
  children,
}: {
  kind: "cognitive" | "english";
  slug: string;
  questionCount: number;
  serverNow: number;
  children: (onComplete: () => void) => ReactNode;
}) {
  const [sitting] = useState(() => {
    const storageKey = `devometrics-sitting:${slug}`;
    try {
      const existing = window.sessionStorage.getItem(storageKey);
      if (existing) return existing;
      const fresh = crypto.randomUUID();
      window.sessionStorage.setItem(storageKey, fresh);
      return fresh;
    } catch {
      return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
    }
  });

  return (
    <IntegrityGate
      kind={kind}
      subjectKey={`${slug}:${sitting}`}
      timeLimitSeconds={testTimeLimit(questionCount)}
      initial={{ available: true, row: null, serverNow }}
      hardExpiry={false}
    >
      {(api) =>
        children(() => {
          try {
            window.sessionStorage.removeItem(`devometrics-sitting:${slug}`);
          } catch {
            /* nothing to clear */
          }
          void api.finish();
        })
      }
    </IntegrityGate>
  );
}
