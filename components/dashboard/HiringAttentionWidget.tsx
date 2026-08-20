import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { HiringAttentionItem } from "@/lib/hiring/attentionSummary";

// Server component — items are already fetched (getHiringAttentionSummary,
// which calls the get_hiring_attention_summary RPC, migration 0140) by the
// page rendering this, same pattern as OverdueAssignmentsWidget/
// EscalatedReviewsWidget. Renders nothing when nothing needs attention.
export default async function HiringAttentionWidget({ items }: { items: HiringAttentionItem[] }) {
  if (items.length === 0) return null;

  const t = await getTranslations("hiringAttentionWidget");

  return (
    <div style={{ background: "rgba(var(--amber-rgb),0.06)", border: "1px solid rgba(var(--amber-rgb),0.25)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>{t("title", { count: items.length })}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => (
          <div key={`${item.category}-${item.candidateId ?? item.postingId}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, fontSize: 12.5 }}>
            <span style={{ color: "var(--text)" }}>
              {item.category === "stale_candidate" ? (
                <>
                  <strong>{item.candidateName ?? t("unknownCandidate")}</strong> — {t("staleCandidate", { posting: item.postingTitle })}
                </>
              ) : (
                <>
                  <strong>{item.postingTitle}</strong> — {t("deadPosting")}
                </>
              )}
            </span>
            <Link
              href={`/dashboard/company/hiring/${item.postingId}`}
              style={{ color: "var(--text-muted)", whiteSpace: "nowrap", textDecoration: "none" }}
            >
              {t("daysAgo", { count: item.days })}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
