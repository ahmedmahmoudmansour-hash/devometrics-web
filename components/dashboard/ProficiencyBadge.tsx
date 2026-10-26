"use client";

import { useTranslations } from "next-intl";
import { proficiencyLevel } from "@/lib/proficiency/levels";

// A small chip showing the named level a 0 to 100 score falls in, for example
// "L3 · Competent". The meaning of each level shows on hover. Renders nothing for
// 0 or no score, so a competency that is not required stays visually quiet.
export default function ProficiencyBadge({ score }: { score: number | null | undefined }) {
  const t = useTranslations("proficiency");
  const level = proficiencyLevel(score);
  if (level === null) return null;
  return (
    <span
      title={t(`desc${level}`)}
      style={{
        flexShrink: 0,
        fontSize: 10,
        fontWeight: 700,
        color: "var(--teal)",
        background: "rgba(var(--teal-rgb),0.1)",
        border: "1px solid rgba(var(--teal-rgb),0.3)",
        borderRadius: 999,
        padding: "1px 7px",
        whiteSpace: "nowrap",
      }}
    >
      {t("levelShort", { level })} · {t(`level${level}`)}
    </span>
  );
}
