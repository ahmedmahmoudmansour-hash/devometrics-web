"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import PrintReportBar from "@/components/assessment/PrintReportBar";
import { MIN_PEOPLE_FOR_PERCENT, type Audience, type CellState, type PersonState, type Readiness, type StepKey } from "@/lib/readiness/core";

const card: React.CSSProperties = { background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 };
const muted: React.CSSProperties = { fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 };

// Colour is never the only signal: every state also has a symbol and a word.
const TONE: Record<CellState, { color: string; symbol: string }> = {
  met: { color: "var(--teal)", symbol: "✓" },
  close: { color: "var(--amber)", symbol: "▲" },
  gap: { color: "var(--danger)", symbol: "✕" },
  notAssessed: { color: "var(--text-muted)", symbol: "–" },
};
const PERSON_TONE: Record<PersonState, { color: string; symbol: string }> = {
  ready: TONE.met,
  close: TONE.close,
  gap: TONE.gap,
  partial: { color: "var(--text-muted)", symbol: "◐" },
  notAssessed: TONE.notAssessed,
};
const STEP_ORDER: StepKey[] = ["roles", "placed", "assessed", "gaps", "development"];

// Talent readiness: where the company stands on the chain from job requirements to assessment to gaps to development, what to do next, and
// per job who is ready, close or short. Printable. With sample=true it shows made-up data for demonstrations.
export default function ReadinessView({ readiness, sample, audience = "admin" }: { readiness: Readiness; sample: boolean; audience?: Audience }) {
  const t = useTranslations("readiness");
  const { steps, kpis, roles, next, unplaced } = readiness;
  const manager = audience === "manager";
  // A manager has their own wording for the same steps (it is their team, and some steps belong to the company admin).
  const word = (key: string) => (manager ? t(`mgr_${key}`) : t(key));
  const home = manager ? "/dashboard/my-team/readiness" : "/dashboard/company/readiness";
  const firstOpen = steps.findIndex((s) => !s.done);

  return (
    <div className="print-plan" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {sample && (
        <div role="status" className="no-print" style={{ ...card, borderColor: "var(--amber)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--amber)", fontWeight: 700 }}>{t("sampleBanner")}</span>
          <Link href={home} style={{ color: "var(--teal)", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>{t("exitSample")}</Link>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <p style={{ ...muted, maxWidth: 680, margin: 0 }}>{word("intro")}</p>
        <PrintReportBar />
      </div>

      {/* the chain, and where the company is on it */}
      <section style={card} aria-label={t("stepsTitle")}>
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {STEP_ORDER.filter((k) => steps.some((x) => x.key === k)).map((key, i) => {
            const s = steps.find((x) => x.key === key)!;
            const state = s.done ? "done" : i === firstOpen ? "current" : "todo";
            return (
              <li key={key} style={{ border: `1px solid ${state === "current" ? "var(--teal)" : "var(--border)"}`, borderRadius: 12, padding: "10px 12px", opacity: state === "todo" ? 0.7 : 1 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: state === "done" ? "var(--teal)" : "var(--text-muted)" }}>
                  {state === "done" ? "✓ " : `${i + 1}. `}
                  {t(`step_${key}`)}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                  {key === "roles" ? s.current : t("stepProgress", { current: s.current, total: s.total })}
                </div>
              </li>
            );
          })}
        </ol>
        {!sample && (
          <div className="no-print" style={{ marginTop: 16, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 320px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--teal)" }}>{t("nextTitle")}</div>
              <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.5, marginTop: 2 }}>{word(`next_${next.key}`)}</div>
            </div>
            {next.href && (
              <Link href={next.href} style={{ background: "var(--teal)", color: "#0A0F1E", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                {word(`button_${next.key}`)}
              </Link>
            )}
          </div>
        )}
      </section>

      {manager && unplaced.length > 0 && (
        <p className="print-avoid-break" style={{ ...card, ...muted, margin: 0 }}>
          <strong style={{ color: "var(--text)" }}>{t("mgr_unplacedTitle")}</strong> <bdi style={{ color: "var(--text)" }}>{unplaced.join(", ")}</bdi>
          <span style={{ display: "block", marginTop: 4 }}>{t("mgr_unplacedHint")}</span>
        </p>
      )}

      {/* four numbers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
        <Kpi label={t("kpi_assessed")} value={String(kpis.assessedPeople)} note={t("kpi_assessedOf", { assessed: kpis.assessedPeople, placed: kpis.placedPeople })} />
        {kpis.assessedPeople > 0 && kpis.assessedPeople < MIN_PEOPLE_FOR_PERCENT ? (
          // Too few people for a percentage to mean anything: show the count, with no colour verdict.
          <Kpi label={t("kpi_ready")} value={t("readyCount", { ready: kpis.readyPeople, assessed: kpis.assessedPeople })} note={t("kpi_readyCountNote", { min: MIN_PEOPLE_FOR_PERCENT })} />
        ) : (
          <Kpi label={t("kpi_ready")} value={kpis.readyPercent === null ? "—" : `${kpis.readyPercent}%`} note={t("kpi_readyNote")} tone={kpis.readyPercent === null ? undefined : kpis.readyPercent >= 70 ? "met" : kpis.readyPercent >= 40 ? "close" : "gap"} />
        )}
        <Kpi label={t("kpi_gap")} value={kpis.biggestGap ? kpis.biggestGap.name : "—"} note={kpis.biggestGap ? t("kpi_gapNote", { shortfall: kpis.biggestGap.shortfall }) : t("kpi_none")} small />
        <Kpi label={t("kpi_waiting")} value={String(kpis.waiting)} note={t("kpi_waitingNote")} />
      </div>

      {/* per job */}
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }} aria-labelledby="readiness-roles">
        <div>
          <h2 id="readiness-roles" style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t("rolesTitle")}</h2>
          <p style={{ ...muted, marginTop: 4 }}>{t("rolesHint")}</p>
          <p className="print-avoid-break" style={{ ...muted, marginTop: 8, display: "flex", gap: 14, flexWrap: "wrap" }}>
            {(["met", "close", "gap", "notAssessed"] as CellState[]).map((k) => (
              <span key={k}><span style={{ color: TONE[k].color, fontWeight: 800 }}>{TONE[k].symbol}</span> {t(`legend_${k}`)}</span>
            ))}
          </p>
        </div>
        {roles.length === 0 && <p style={{ ...card, ...muted }}>{word("empty")}</p>}
        {roles.map((r, idx) => (
          <details key={r.roleId} open={idx === 0} className="print-avoid-break" style={card}>
            <summary style={{ cursor: "pointer", listStyle: "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                  <bdi>{r.title}</bdi>
                  <span style={{ ...muted, fontWeight: 400, marginInlineStart: 8 }}><bdi>{r.family}</bdi></span>
                </span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {t("people", { count: r.people })} · {t("assessedCount", { assessed: r.assessed })}
                  {r.readyPercent !== null && (
                    <> · <bdi><strong style={{ color: "var(--text)" }}>{r.assessed < MIN_PEOPLE_FOR_PERCENT ? t("readyCount", { ready: r.ready, assessed: r.assessed }) : t("readyPercent", { percent: r.readyPercent })}</strong></bdi></>
                  )}
                </span>
              </div>
              <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginTop: 10, background: "rgba(128,128,128,0.18)" }} role="img" aria-label={t("barLabel", { ready: r.ready, close: r.close, gap: r.gap, partial: r.partial, none: r.people - r.assessed })}>
                {[
                  [r.ready, "met"],
                  [r.close, "close"],
                  [r.gap, "gap"],
                  [r.partial, "partial"],
                ].map(([n, k]) => (n as number) > 0 && <span key={k as string} style={{ width: `${((n as number) / r.people) * 100}%`, background: k === "partial" ? "rgba(128,128,128,0.45)" : TONE[k as CellState].color }} />)}
              </div>
            </summary>

            {r.assessed === 0 ? (
              <p style={{ ...muted, marginTop: 14 }}>{t("notAssessedYet")}</p>
            ) : (
              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", margin: "0 0 6px" }}>{t("competencies")}</h3>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ color: "var(--text-muted)", fontSize: 11 }}>
                        <th style={{ textAlign: "start", padding: "4px 6px" }}>{t("colCompetency")}</th>
                        <th style={{ textAlign: "end", padding: "4px 6px" }}>{t("colRequired")}</th>
                        <th style={{ textAlign: "end", padding: "4px 6px" }}>{t("colAverage")}</th>
                        <th style={{ textAlign: "end", padding: "4px 6px" }}>{t("colMet")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.competencies.map((c) => {
                        const st: CellState = c.average === null ? "notAssessed" : c.average >= c.required ? "met" : c.required - c.average <= 1 ? "close" : "gap";
                        return (
                          <tr key={c.name} style={{ borderTop: "1px solid var(--border)" }}>
                            <td style={{ padding: "6px", color: "var(--text)" }}><bdi>{c.name}</bdi></td>
                            <td style={{ padding: "6px", textAlign: "end", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>L{c.required}</td>
                            <td style={{ padding: "6px", textAlign: "end", fontWeight: 700, color: TONE[st].color, fontVariantNumeric: "tabular-nums" }}>{TONE[st].symbol} {c.average ?? "—"}</td>
                            <td style={{ padding: "6px", textAlign: "end", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{c.met}/{c.assessed}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", margin: "0 0 6px" }}>{t("peopleTitle")}</h3>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {r.persons.map((p) => (
                      <li key={p.userId} style={{ borderTop: "1px solid var(--border)", padding: "7px 0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                          <span style={{ color: "var(--text)" }}><bdi>{p.name}</bdi></span>
                          <span style={{ color: PERSON_TONE[p.state].color, fontWeight: 700, fontSize: 12 }}>{PERSON_TONE[p.state].symbol} {t(`state_${p.state}`)}</span>
                        </div>
                        {p.competencies.length > 0 && (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                            {p.competencies.map((c, i) => (
                              <span key={i} title={c.name} style={{ fontSize: 11, border: `1px solid ${TONE[c.state].color}`, color: TONE[c.state].color, borderRadius: 6, padding: "1px 6px", fontVariantNumeric: "tabular-nums" }}>
                                {TONE[c.state].symbol} {c.demonstrated ?? "–"}/{c.required ?? "–"}
                              </span>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </details>
        ))}
      </section>

      <p style={{ ...muted, margin: 0 }}>{t("caution")}</p>
      {!sample && kpis.assessedPeople === 0 && (
        <p className="no-print" style={{ ...muted, margin: 0 }}>
          <Link href={`${home}?sample=1`} style={{ color: "var(--teal)", fontWeight: 700, textDecoration: "none" }}>{t("trySample")}</Link>
        </p>
      )}
    </div>
  );
}

function Kpi({ label, value, note, tone, small }: { label: string; value: string; note: string; tone?: CellState; small?: boolean }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>{label}</div>
      <div style={{ fontSize: small ? 18 : 30, fontWeight: 800, color: tone ? TONE[tone].color : "var(--text)", marginTop: 6, lineHeight: 1.15, fontVariantNumeric: "tabular-nums" }}>
        <bdi>{value}</bdi>
      </div>
      <div style={{ ...muted, marginTop: 4 }}>{note}</div>
    </div>
  );
}
