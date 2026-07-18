"use client";

import { useState, useTransition } from "react";
import { listMyDirectReportReviews } from "@/lib/performanceReviews/actions";
import ImpactCycleReviewRow from "@/components/dashboard/ImpactCycleReviewRow";
import type { ReviewListItem } from "@/lib/performanceReviews/types";

export default function MyTeamReviews({ initial }: { initial: ReviewListItem[] }) {
  const [items, setItems] = useState(initial);
  const [, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const result = await listMyDirectReportReviews();
      setItems(result.items);
    });
  }

  if (items.length === 0) {
    return (
      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          None of your direct reports have an active Impact Cycle yet — that starts once your
          organization&apos;s admin opens a cycle for your team.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item) => (
        <ImpactCycleReviewRow key={item.id} item={item} onChanged={refresh} />
      ))}
    </div>
  );
}
