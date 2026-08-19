"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { startProbationReview } from "@/lib/performanceReviews/probation";
import { useConfirmClick } from "@/lib/ui/useConfirmClick";

export default function StartProbationReviewButton({ employeeUserId }: { employeeUserId: string }) {
  const t = useTranslations("startProbationReviewButton");
  const tConfirm = useTranslations("confirmActions");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const { confirming, handleClick } = useConfirmClick(() => {
    setError(null);
    startTransition(async () => {
      const result = await startProbationReview(employeeUserId);
      if ("error" in result) setError(result.error);
      else {
        setDone(true);
        router.refresh();
      }
    });
  });

  if (done) {
    return <p style={{ fontSize: 12.5, color: "var(--teal)" }}>{t("started")}</p>;
  }

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        style={{
          background: "none",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "8px 14px",
          fontSize: 12.5,
          fontWeight: 700,
          color: confirming ? "var(--danger)" : "var(--text)",
          cursor: "pointer",
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {confirming ? tConfirm("clickAgainToConfirm") : t("start")}
      </button>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>{t("hint")}</p>
      {error && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>{error}</p>}
    </div>
  );
}
