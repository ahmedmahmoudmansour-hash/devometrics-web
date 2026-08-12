"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { acceptProbationReview, type PendingProbationAcceptance } from "@/lib/performanceReviews/actions";

// Surfaces new-hire probation reviews created by runHireToProbation
// (lib/automations/recipes.ts) that are hidden from the employee until
// THIS manager accepts them (migration 0122's acceptance gate). An accepted
// item drops out of `items` immediately (optimistic) since the server-side
// filter that produced `initial` would exclude it on the next real fetch.
export default function ProbationAcceptanceCard({ initial }: { initial: PendingProbationAcceptance[] }) {
  const t = useTranslations("probationAcceptanceCard");
  const [items, setItems] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (items.length === 0) return null;

  function accept(reviewId: string) {
    setError(null);
    startTransition(async () => {
      const result = await acceptProbationReview(reviewId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setItems((prev) => prev.filter((i) => i.reviewId !== reviewId));
    });
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{t("title")}</p>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>{t("hint")}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item) => (
          <div
            key={item.reviewId}
            style={{
              background: "var(--navy-mid)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{t("readyFor", { name: item.employeeName })}</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{item.cycleName}</p>
            </div>
            <button
              type="button"
              disabled={isPending}
              onClick={() => accept(item.reviewId)}
              style={{
                background: "var(--teal)",
                color: "#0A0F1E",
                border: "none",
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {t("acceptButton")}
            </button>
          </div>
        ))}
      </div>
      {error && <p style={{ color: "#f87171", fontSize: 12.5, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
