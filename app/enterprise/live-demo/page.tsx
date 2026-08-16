import { getTranslations } from "next-intl/server";
import Avatar from "@/components/Avatar";
import CapabilityPyramid from "@/components/CapabilityPyramid";
import { levelBg, levelText } from "@/lib/ui/levelColor";
import { COMPETENCY_DIMENSIONS, dimensionLabel } from "@/lib/gap-analysis/dimensions";
import { SAMPLE_ROWS_LEVELS, SAMPLE_AVERAGES, sampleCellStyle, sampleHeadStyle } from "@/lib/enterprise/sampleWorkspace";

export default async function EnterpriseLiveDemoPage() {
  const t = await getTranslations("enterprisePage");
  const tDim = await getTranslations("competencyDimensions");

  const sampleTitles = [t("sampleTitle1"), t("sampleTitle2"), t("sampleTitle3")];
  const sampleRows = SAMPLE_ROWS_LEVELS.map((r, i) => ({
    ...r,
    title: sampleTitles[i],
  }));

  return (
    <section id="workspace" style={{ padding: "0 24px 100px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <span
          style={{
            fontSize: 11,
            color: "var(--teal)",
            background: "rgba(var(--teal-rgb),0.1)",
            border: "1px solid rgba(var(--teal-rgb),0.2)",
            borderRadius: 100,
            padding: "4px 12px",
            fontWeight: 700,
          }}
        >
          {t("sampleBadge")}
        </span>
      </div>
      <p style={{ textAlign: "center", fontSize: 14, color: "var(--text-muted)", maxWidth: 560, margin: "12px auto 40px" }}>
        {t("sampleSubtext")}
      </p>

      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", marginBottom: 32 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...sampleHeadStyle, textAlign: "start" }}>{t("tableNameHeader")}</th>
                {COMPETENCY_DIMENSIONS.map((d) => (
                  <th key={d} style={{ ...sampleHeadStyle, textAlign: "center", whiteSpace: "nowrap" }}>
                    {dimensionLabel(tDim, d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sampleRows.map((r) => (
                <tr key={r.name}>
                  <td style={sampleCellStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Avatar name={r.name} avatarUrl={null} />
                      <div>
                        <div>{r.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.title}</div>
                      </div>
                    </div>
                  </td>
                  {COMPETENCY_DIMENSIONS.map((d) => (
                    <td key={d} className="mono" style={{ ...sampleCellStyle, textAlign: "center", background: levelBg(r.levels[d]) }}>
                      {r.levels[d]}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td style={{ ...sampleCellStyle, fontWeight: 700, color: "var(--text-muted)" }}>{t("teamAverage")}</td>
                {COMPETENCY_DIMENSIONS.map((d) => (
                  <td key={d} className="mono" style={{ ...sampleCellStyle, textAlign: "center", fontWeight: 700, color: levelText(SAMPLE_AVERAGES[d]) }}>
                    {SAMPLE_AVERAGES[d]}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Turns the raw score table into the actual point of it: not
          "here are some numbers" but "here's the decision this
          surfaces" — the exact gap between a competency graph and a
          decision engine. */}
      <div
        style={{
          background: "rgba(var(--teal-rgb),0.06)",
          border: "1px solid rgba(var(--teal-rgb),0.2)",
          borderRadius: 16,
          padding: "24px 28px",
          marginBottom: 32,
          display: "flex",
          gap: 16,
          alignItems: "flex-start",
        }}
      >
        <span
          className="mono"
          style={{
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: "var(--teal)",
            background: "rgba(var(--teal-rgb),0.12)",
            border: "1px solid rgba(var(--teal-rgb),0.3)",
            borderRadius: 100,
            padding: "4px 12px",
            textTransform: "uppercase",
          }}
        >
          {t("sampleInsightLabel")}
        </span>
        <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.7 }}>{t("sampleInsightText")}</p>
      </div>

      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, display: "flex", justifyContent: "center" }}>
        <CapabilityPyramid dimensionLevels={SAMPLE_AVERAGES} />
      </div>
    </section>
  );
}
