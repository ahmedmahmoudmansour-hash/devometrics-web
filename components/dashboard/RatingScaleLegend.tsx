"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { competencyRatingLabel, competencyRatingDescription } from "@/lib/performanceReviews/types";

// Complements (doesn't replace) the per-select live description each rating
// editor already shows — that one only ever surfaces whatever's currently
// picked in ONE row. With several competencies to rate, comparing all 5
// anchors side by side before picking is a different, genuinely useful
// view, especially for staying consistent across rows. Collapsed by
// default so it doesn't add permanent weight to a list that can already
// run to 8 rows.
export default function RatingScaleLegend() {
  const t = useTranslations("performanceReviewLabels");
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ marginBottom: 10 }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{ background: "none", border: "none", padding: 0, color: "var(--teal)", fontSize: 11, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}
      >
        {expanded ? t("hideScaleLegend") : t("showScaleLegend")}
      </button>
      {expanded && (
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} style={{ display: "flex", gap: 8, fontSize: 11 }}>
              <span style={{ fontWeight: 700, color: "var(--teal)", flexShrink: 0, minWidth: 18 }}>{n}</span>
              <span style={{ color: "var(--text-muted)", lineHeight: 1.4 }}>
                <strong style={{ color: "var(--text)" }}>{competencyRatingLabel(t, n)}</strong> — {competencyRatingDescription(t, n)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
