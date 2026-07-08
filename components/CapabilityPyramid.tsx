import { PYRAMID_TIERS, tierAverage } from "@/lib/gap-analysis/pyramid";
import type { CompetencyDimension } from "@/lib/gap-analysis/dimensions";
import { levelBg, levelText } from "@/lib/ui/levelColor";

const TIER_WIDTH: Record<string, number> = {
  organizational: 240,
  professional: 400,
  personal: 580,
};

export default function CapabilityPyramid({
  dimensionLevels,
  compact = false,
}: {
  dimensionLevels?: Partial<Record<CompetencyDimension, number>>;
  compact?: boolean;
}) {
  const showLevels = !!dimensionLevels;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {PYRAMID_TIERS.map((tier, i) => {
        const avg = dimensionLevels ? tierAverage(tier, dimensionLevels) : null;
        return (
          <div
            key={tier.key}
            style={{
              width: TIER_WIDTH[tier.key],
              maxWidth: "92vw",
              clipPath: "polygon(6% 0%, 94% 0%, 100% 100%, 0% 100%)",
              background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
              border: "1px solid var(--border)",
              borderTop: i === 0 ? "1px solid color-mix(in srgb, var(--teal) 40%, transparent)" : "1px solid var(--border)",
              padding: compact ? "16px 32px 14px" : "20px 40px 18px",
              marginTop: i === 0 ? 0 : -1,
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: compact ? 11 : 12,
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                  textTransform: "uppercase",
                  color: "var(--text)",
                }}
              >
                {tier.label}
              </span>
              {showLevels && (
                <span style={{ fontSize: 11, fontWeight: 700, color: levelText(avg) }}>
                  {avg ?? "—"} avg
                </span>
              )}
            </div>
            {!compact && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, marginBottom: 10 }}>{tier.subtitle}</div>
            )}
            <div style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap", marginTop: compact ? 8 : 0 }}>
              {tier.dimensions.map((d) => {
                const level = dimensionLevels?.[d];
                return (
                  <span
                    key={d}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 100,
                      background: showLevels ? levelBg(level) : "color-mix(in srgb, var(--text-muted) 8%, transparent)",
                      color: showLevels ? levelText(level) : "var(--text-muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {d}
                    {showLevels && ` · ${level ?? "—"}`}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
      {showLevels && (
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 14, textAlign: "center", maxWidth: 420 }}>
          — means that dimension hasn&apos;t been assessed yet (via Gap Analysis).
        </p>
      )}
    </div>
  );
}
