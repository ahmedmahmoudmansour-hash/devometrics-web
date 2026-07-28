"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { deleteCustomScenario } from "@/app/dashboard/roleplay/customActions";

export default function DeleteScenarioButton({ scenarioId }: { scenarioId: string }) {
  const t = useTranslations("deleteScenarioButton");
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(async () => {
          await deleteCustomScenario(scenarioId);
        });
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
      {t("delete")}
    </button>
  );
}
