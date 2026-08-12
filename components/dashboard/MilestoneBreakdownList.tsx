"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { breakdownMilestoneIntoTasks } from "@/lib/tasks/actions";
import type { Milestone } from "@/lib/supabase/types";

function MilestoneRow({ milestone }: { milestone: Milestone }) {
  const t = useTranslations("milestoneBreakdownList");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  // Tracked separately from `message` itself — the message text is now
  // translated, so an English-only substring check (e.g. message.includes
  // ("Added")) would silently stop matching once the UI is in Arabic.
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  function handleBreakdown() {
    setMessage(null);
    startTransition(async () => {
      const result = await breakdownMilestoneIntoTasks(milestone.id);
      if (result?.error) {
        setSuccess(false);
        setMessage(result.error);
        return;
      }
      setSuccess(true);
      setMessage(t("addedTasksMessage", { count: result?.count ?? 0 }));
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 13, color: "var(--text)" }}>{milestone.title}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {message && <span style={{ fontSize: 11, color: success ? "var(--teal)" : "var(--danger)" }}>{message}</span>}
        <button
          type="button"
          onClick={handleBreakdown}
          disabled={isPending}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 12,
            color: "var(--teal)",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {isPending ? t("thinking") : t("breakIntoTasks")}
        </button>
      </div>
    </div>
  );
}

export default function MilestoneBreakdownList({ milestones }: { milestones: Milestone[] }) {
  const t = useTranslations("milestoneBreakdownList");
  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{t("title")}</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>
        {t("subtitle")}
      </p>
      <div>
        {milestones.map((m) => (
          <MilestoneRow key={m.id} milestone={m} />
        ))}
      </div>
    </div>
  );
}
