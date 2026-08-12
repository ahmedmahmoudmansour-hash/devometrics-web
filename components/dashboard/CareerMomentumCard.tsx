import { useTranslations } from "next-intl";
import type { MomentumResult } from "@/lib/momentum/momentum";

export default function CareerMomentumCard({ momentum }: { momentum: MomentumResult }) {
  const t = useTranslations("careerMomentumCard");

  if (momentum.status === "insufficient_data") {
    return (
      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("title")}</h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {t("insufficientData")}
        </p>
      </div>
    );
  }

  const { deltaPoints, deltaPercent, currentScore, daysSince } = momentum;
  const improving = deltaPoints > 0;
  const flat = deltaPoints === 0;
  const color = improving ? "var(--teal)" : flat ? "var(--text-muted)" : "var(--danger)";
  const arrow = improving ? "↑" : flat ? "→" : "↓";

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>{t("title")}</h2>
      <p className="mono" style={{ fontSize: 26, fontWeight: 700, color }}>
        {arrow} {Math.abs(deltaPoints)} pt{Math.abs(deltaPoints) === 1 ? "" : "s"}
        <span style={{ fontSize: 15, fontWeight: 600, marginLeft: 8 }}>
          ({deltaPercent >= 0 ? "+" : ""}
          {deltaPercent}%)
        </span>
      </p>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
        {t("trendLine", {
          direction: improving ? t("up") : flat ? t("flat") : t("down"),
          days: daysSince,
          score: currentScore,
        })}
      </p>
    </div>
  );
}
