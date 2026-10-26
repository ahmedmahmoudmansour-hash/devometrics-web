import { useTranslations } from "next-intl";
import { COMPETENCY_DIMENSIONS, dimensionLabel } from "@/lib/gap-analysis/dimensions";
import { PROFICIENCY_LEVELS } from "@/lib/proficiency/levels";
import { standardDescriptionKey, standardLevelKey } from "@/lib/proficiency/library";

// Read-only view of the eight standard competencies every workspace scores, with
// what each of the five levels looks like. The wording is a starting point.
export default function StandardCompetencyLibrary() {
  const t = useTranslations("competencyLibrary");
  const tDim = useTranslations("competencyDimensions");
  const tProf = useTranslations("proficiency");

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginTop: 20 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{t("standardTitle")}</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6, maxWidth: 720 }}>{t("standardHint")}</p>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {COMPETENCY_DIMENSIONS.map((dim) => (
          <details key={dim} style={{ borderTop: "1px solid var(--border)", padding: "10px 0" }}>
            <summary style={{ cursor: "pointer", listStyle: "none" }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{dimensionLabel(tDim, dim)}</span>
              <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.5 }}>
                {t(standardDescriptionKey(dim))}
              </span>
              <span style={{ display: "block", fontSize: 11.5, color: "var(--teal)", marginTop: 4 }}>{t("showLevels")}</span>
            </summary>
            <ol style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {PROFICIENCY_LEVELS.map((level) => (
                <li key={level} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                  <span style={{ flexShrink: 0, width: 130, fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)" }}>
                    {tProf("levelShort", { level })} · {tProf(`level${level}`)}
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.5 }}>{t(standardLevelKey(dim, level))}</span>
                </li>
              ))}
            </ol>
          </details>
        ))}
      </div>
    </div>
  );
}
