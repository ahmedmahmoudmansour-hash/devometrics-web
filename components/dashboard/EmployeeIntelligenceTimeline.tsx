import type { ScoreEvent } from "@/lib/scoring/scoreEvents";
import { groupScoreHistoryIntoMoments } from "@/lib/scoring/scoreEvents";
import { summarizeEmployeeTrend } from "@/lib/scoring/summarizeTrend";

// The Employee Intelligence Timeline — the one place the unified score-
// tracking layer (migration 0147) is actually consumed, not just written
// to. Explicit design constraint from review: this must read as a story
// ("they've been improving, but career health dipped recently"), not a
// table of rows from six database tables. Concretely: named like a feature
// ("{name}'s Talent Journey"), the plain-language trend summary leads above
// the fold, a real connected vertical thread (not a bare list), and
// multiple score_events sharing one real-world moment (e.g. a Gap
// Analysis's whole-score row plus its 8 dimension rows) collapse into one
// entry with detail on expand — <details>/<summary> rather than a client
// component, so the expand/collapse works with zero JS.
//
// Server component — everything here is pure formatting over data the page
// already fetched (buildEmployeeDetail's scoreHistory), no new query.

type TFunc = (key: string, values?: Record<string, string | number>) => string;

function formatValue(rawValue: number, scale: "0_100" | "1_5"): string {
  return scale === "1_5" ? `${rawValue}/5` : `${Math.round(rawValue)}`;
}

export default function EmployeeIntelligenceTimeline({
  employeeName,
  scoreHistory,
  t,
  resolveLabel,
  dateLocale,
}: {
  employeeName: string;
  scoreHistory: ScoreEvent[];
  t: TFunc;
  // Resolves a human label for a source, optionally scoped to one
  // dimension — e.g. ("gap_analysis") -> "Gap Analysis", ("gap_analysis",
  // "Leadership") -> "Leadership" (dimensions reuse the existing
  // competencyDimensions translations, since most sources' dimension
  // values are the same 8 fixed CompetencyDimension strings already
  // translated everywhere else in the app).
  resolveLabel: (source: string, dimension?: string) => string;
  dateLocale: string;
}) {
  if (scoreHistory.length === 0) return null;

  const moments = groupScoreHistoryIntoMoments(scoreHistory).reverse(); // most recent first
  const signals = summarizeEmployeeTrend(scoreHistory).filter((s) => s.direction !== "stable");

  return (
    <div
      className="print-avoid-break"
      style={{
        background: "var(--navy-mid)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 24,
      }}
    >
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
        {t("heading", { name: employeeName })}
      </h2>

      {signals.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
          {signals.slice(0, 3).map((signal, i) => (
            <p key={i} style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.6 }}>
              <span style={{ marginInlineEnd: 6 }}>{signal.direction === "improving" ? "↗" : "↘"}</span>
              {t(signal.direction === "improving" ? "trendImproving" : "trendDeclining", {
                source: resolveLabel(signal.source, signal.dimension || undefined),
                previous: formatValue(signal.previousValue, signal.scale),
                latest: formatValue(signal.latestValue, signal.scale),
                count: signal.cycleCount,
              })}
            </p>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 20 }}>{t("noTrendYet")}</p>
      )}

      <div style={{ position: "relative", paddingInlineStart: 20 }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            insetInlineStart: 5,
            top: 6,
            bottom: 6,
            width: 2,
            background: "var(--border)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {moments.map((moment) => {
            const dimensionDetails = moment.details.filter((d) => d.dimension !== "");
            return (
              <div key={moment.key} style={{ position: "relative", paddingInlineStart: 14 }}>
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    insetInlineStart: -20,
                    top: 4,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: "var(--navy-mid)",
                    border: "2px solid var(--teal)",
                  }}
                />
                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {new Date(moment.recordedAt).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })}
                </p>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", marginTop: 2 }}>
                  {resolveLabel(moment.source)} — {formatValue(moment.headline.rawValue, moment.headline.scale)}
                  {moment.headline.scale === "0_100" ? "/100" : ""}
                </p>
                {dimensionDetails.length > 0 && (
                  <details style={{ marginTop: 4 }}>
                    <summary style={{ fontSize: 12, color: "var(--teal)", cursor: "pointer" }}>
                      {t("seeDetail", { count: dimensionDetails.length })}
                    </summary>
                    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
                      {dimensionDetails.map((d) => (
                        <div key={d.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)" }}>
                          <span>{resolveLabel(d.source, d.dimension)}</span>
                          <span className="mono">{formatValue(d.rawValue, d.scale)}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
