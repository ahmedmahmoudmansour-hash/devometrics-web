"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { deleteCustomScenario } from "@/app/dashboard/roleplay/customActions";
import { useConfirmClick } from "@/lib/ui/useConfirmClick";

export default function DeleteScenarioButton({ scenarioId }: { scenarioId: string }) {
  const t = useTranslations("deleteScenarioButton");
  const tConfirm = useTranslations("confirmActions");
  const [isPending, startTransition] = useTransition();

  const { confirming, handleClick } = useConfirmClick(() => {
    startTransition(async () => {
      await deleteCustomScenario(scenarioId);
    });
  });

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleClick();
      }}
      aria-label={t("deleteAriaLabel")}
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        background: "rgba(0,0,0,0.3)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "4px 10px",
        fontSize: 11,
        color: "var(--text-muted)",
        cursor: "pointer",
        opacity: isPending ? 0.5 : 1,
      }}
    >
      {confirming ? tConfirm("clickAgainToConfirm") : t("delete")}
    </button>
  );
}
