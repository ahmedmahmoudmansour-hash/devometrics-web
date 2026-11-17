"use client";

import { useTranslations } from "next-intl";
import { formatClock, hasSignals, summarize, type IntegrityRow, type IntegritySummary } from "@/lib/integrity/core";

// How an assessment was taken, shown beside the result for the person, their manager and company admins (and on the printed
// report). Quiet when nothing unusual happened; amber when there is something to talk about. Signals, never proof.
type T = ReturnType<typeof useTranslations>;

// The sentence parts describing how a sitting went, in the order a manager reads them.
export function integrityParts(t: T, s: IntegritySummary, withPromise = true): string[] {
  const parts: string[] = [];
  if (withPromise) parts.push(s.attested ? t("notePromise") : t("noPromise"));
  if (s.usedSeconds !== null) parts.push(s.limitSeconds ? t("noteTime", { used: formatClock(s.usedSeconds), limit: formatClock(s.limitSeconds) }) : t("noteTimeOnly", { used: formatClock(s.usedSeconds) }));
  parts.push(t("noteLeft", { count: s.leftPage }) + (s.leftPage > 0 && s.awaySeconds > 0 ? ` (${t("noteAway", { time: formatClock(s.awaySeconds) })})` : ""));
  if (s.late) parts.push(t("noteLate"));
  if (s.bulkInserts > 0) parts.push(t("noteBulk", { count: s.bulkInserts }));
  return parts;
}

export default function IntegrityNote({ row }: { row: IntegrityRow | null }) {
  const t = useTranslations("integrity");
  if (!row) return null;
  const s = summarize(row);
  const attention = hasSignals(s);
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px" }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t("noteTitle")}</p>
      <p style={{ fontSize: 12, color: attention ? "var(--amber)" : "var(--text-muted)", lineHeight: 1.6, margin: "4px 0 0" }}>{integrityParts(t, s).join(" · ")}</p>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0" }}>{attention ? t("noteHelp") : t("noteCalm")}</p>
    </div>
  );
}
