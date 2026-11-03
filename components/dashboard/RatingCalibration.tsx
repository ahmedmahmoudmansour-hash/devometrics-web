import { getTranslations } from "next-intl/server";
import { getCalibrationReport } from "@/lib/performanceReviews/actions";
import { CALIBRATION, type CalibrationFlag } from "@/lib/performanceReviews/calibration";
import type { PerformanceReviewCycle } from "@/lib/performanceReviews/types";

const card = { background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 } as const;
const th = { textAlign: "start", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", padding: "6px 10px", borderBottom: "1px solid var(--border)" } as const;
const td = { fontSize: 13, color: "var(--text)", padding: "8px 10px", borderBottom: "1px solid var(--border)", fontVariantNumeric: "tabular-nums" } as const;

// A pattern worth discussing, never a verdict. Calm wording and the same colour for every prompt.
const FLAG_KEY: Record<CalibrationFlag, "flagAbove" | "flagBelow" | "flagNarrow"> = {
  above_company: "flagAbove",
  below_company: "flagBelow",
  narrow_spread: "flagNarrow",
};

export default async function RatingCalibration({ cycles, selectedCycleId }: { cycles: PerformanceReviewCycle[]; selectedCycleId: string }) {
  const t = await getTranslations("ratingCalibration");
  const report = await getCalibrationReport(selectedCycleId);
  if (!report) return null;

  const maxBar = Math.max(1, ...Object.values(report.distribution));
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <section style={{ ...card, marginTop: 20 }} aria-labelledby="calibration-title">
      <h2 id="calibration-title" style={{ fontSize: 17, fontWeight: 700, color: "var(--text)" }}>
        {t("title")}
      </h2>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 720 }}>{t("intro", { min: CALIBRATION.minRatings })}</p>

      <form method="get" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
        <label htmlFor="calibrationCycle" style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {t("cycleLabel")}
        </label>
        <select
          id="calibrationCycle"
          name="calibrationCycle"
          defaultValue={selectedCycleId}
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 10px", fontSize: 12, color: "var(--text)" }}
        >
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" style={{ background: "rgba(var(--teal-rgb),0.1)", border: "1px solid rgba(var(--teal-rgb),0.3)", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 700, color: "var(--teal)", cursor: "pointer" }}>
          {t("show")}
        </button>
      </form>

      {report.totalRatings === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 16 }}>{t("empty")}</p>
      ) : (
        <>
          <p style={{ fontSize: 13, color: "var(--text)", marginTop: 16 }}>
            {t("company", { count: report.totalRatings, mean: report.companyMean ?? "-", spread: report.companySpread ?? "-" })}
          </p>

          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>{t("distribution")}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 420 }}>
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <div key={n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 14, fontSize: 12, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{n}</span>
                  <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 10 }}>
                    <div style={{ width: `${(report.distribution[n] / maxBar) * 100}%`, background: "var(--teal)", height: 10, borderRadius: 4 }} />
                  </div>
                  <span style={{ width: 28, fontSize: 12, color: "var(--text)", textAlign: "end", fontVariantNumeric: "tabular-nums" }}>{report.distribution[n]}</span>
                </div>
              ))}
            </div>
          </div>

          {report.managers.length > 0 && (
            <div style={{ overflowX: "auto", marginTop: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                <thead>
                  <tr>
                    <th style={th}>{t("colManager")}</th>
                    <th style={th}>{t("colRatings")}</th>
                    <th style={th}>{t("colAverage")}</th>
                    <th style={th}>{t("colSpread")}</th>
                    <th style={th}>{t("colHigh")}</th>
                    <th style={th}>{t("colLow")}</th>
                    <th style={th}>{t("colSelfGap")}</th>
                    <th style={th}>{t("colPrompt")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.managers.map((m) => (
                    <tr key={m.reviewerUserId}>
                      <td style={td}>{m.name}</td>
                      <td style={td}>{m.count}</td>
                      <td style={td}>{m.mean.toFixed(2)}</td>
                      <td style={td}>{m.spread.toFixed(2)}</td>
                      <td style={td}>{pct(m.shareHigh)}</td>
                      <td style={td}>{pct(m.shareLow)}</td>
                      <td style={td}>{m.selfGap === null ? "-" : `${m.selfGap > 0 ? "+" : ""}${m.selfGap.toFixed(2)}`}</td>
                      <td style={{ ...td, color: "var(--amber)", fontSize: 12 }}>{m.flags.map((f) => t(FLAG_KEY[f])).join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {report.hiddenManagers > 0 && (
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>
              {t("hidden", { managers: report.hiddenManagers, min: CALIBRATION.minRatings })}
            </p>
          )}
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.6, maxWidth: 720 }}>{t("footnote")}</p>
        </>
      )}
    </section>
  );
}
