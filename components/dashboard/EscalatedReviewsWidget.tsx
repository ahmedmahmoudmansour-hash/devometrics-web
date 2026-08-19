import { getTranslations } from "next-intl/server";
import type { EscalatedReview } from "@/lib/performanceReviews/actions";

// Server component — items are already fetched (getEscalatedReviews, which
// calls the get_escalated_reviews RPC, migration 0137) by the page
// rendering this, same pattern as OverdueAssignmentsWidget. Renders
// nothing when there's nothing currently escalated.
export default async function EscalatedReviewsWidget({ items }: { items: EscalatedReview[] }) {
  if (items.length === 0) return null;

  const t = await getTranslations("escalatedReviewsWidget");

  return (
    <div style={{ background: "rgba(var(--amber-rgb),0.06)", border: "1px solid rgba(var(--amber-rgb),0.25)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>{t("title", { count: items.length })}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => (
          <div key={item.reviewId} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, fontSize: 12.5 }}>
            <span style={{ color: "var(--text)" }}>
              <strong>{item.employeeName ?? t("unknownEmployee")}</strong> — {item.cycleName}
              {item.escalationComment && <span style={{ color: "var(--text-muted)" }}> · {t("commentQuoted", { comment: item.escalationComment })}</span>}
            </span>
            <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{new Date(item.escalationRequestedAt).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
