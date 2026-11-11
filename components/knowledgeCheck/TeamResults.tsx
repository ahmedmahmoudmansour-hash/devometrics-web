"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import type { TeamResultsView } from "@/lib/knowledgeBank/actions";
import { formatClock } from "@/lib/knowledgeBank/timer";

const card: React.CSSProperties = { background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 };
const muted: React.CSSProperties = { fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 };
const tone = (r: "strong" | "adequate" | "gaps") => (r === "strong" ? "var(--teal)" : r === "adequate" ? "var(--amber)" : "var(--danger)");

// Where a team is strong or weak, from the knowledge checks people have finished. Weakest competency first, so the first thing a
// manager sees is where to act. Bars carry the number too, so colour is never the only signal.
export default function TeamResults({ data, isAdmin }: { data: TeamResultsView; isAdmin: boolean }) {
  const t = useTranslations("teamResults");
  const format = useFormatter();
  const n = data.people.length;
  if (n === 0) return null;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 18 }} aria-labelledby="team-results-title">
      <div style={card}>
        <h2 id="team-results-title" style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>
          {t("title")}
        </h2>
        <p style={{ ...muted, marginTop: 6 }}>{t("basis", { count: n })}</p>

        <div style={{ display: "flex", gap: 24, marginTop: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "var(--text)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{t("percent", { percent: data.averagePercent ?? 0 })}</div>
            <div style={{ ...muted, marginTop: 4 }}>{t("average")}</div>
          </div>
          {(["strong", "adequate", "gaps"] as const).map((k) => (
            <div key={k}>
              <div style={{ fontSize: 22, fontWeight: 800, color: tone(k), fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{data.counts[k]}</div>
              <div style={{ ...muted, marginTop: 4 }}>{t(`band_${k}`)}</div>
            </div>
          ))}
        </div>
        {n < 3 && <p style={{ ...muted, color: "var(--amber)", marginTop: 12 }}>{t("fewPeople")}</p>}
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t("byCompetency")}</h3>
        <p style={{ ...muted, marginTop: 4 }}>{t("byCompetencyHint")}</p>
        <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {data.competencies.map((c) => (
            <li key={c.competencyKey}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
                <span style={{ color: "var(--text)" }}>{c.name}</span>
                <span style={{ color: tone(c.reading), fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                  {t("percent", { percent: c.percent })} <span style={{ ...muted, fontWeight: 400 }}>· {t("peopleCount", { count: c.people })}</span>
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: "rgba(128,128,128,0.18)", marginTop: 5, overflow: "hidden" }} role="img" aria-label={t("barLabel", { name: c.name, percent: c.percent })}>
                <div style={{ width: `${c.percent}%`, height: "100%", background: tone(c.reading), borderRadius: 4 }} />
              </div>
            </li>
          ))}
        </ul>
        {isAdmin && data.competencies.some((c) => c.reading === "gaps") && (
          <p style={{ marginTop: 14, fontSize: 13 }}>
            <Link href="/dashboard/company/knowledge-hub" style={{ color: "var(--teal)", fontWeight: 700, textDecoration: "none" }}>
              {t("assignLearning")}
            </Link>
          </p>
        )}
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t("byPerson")}</h3>
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <th style={{ padding: "6px 8px", textAlign: "start" }}>{t("colPerson")}</th>
                <th style={{ padding: "6px 8px", textAlign: "start" }}>{t("colRole")}</th>
                <th style={{ padding: "6px 8px", textAlign: "end" }}>{t("colScore")}</th>
                <th style={{ padding: "6px 8px", textAlign: "start" }}>{t("colTaken")}</th>
                <th style={{ padding: "6px 8px", textAlign: "start" }}>{t("colTime")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.people.map((p) => (
                <tr key={p.userId} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: 8, color: "var(--text)" }}>{p.name}</td>
                  <td style={{ padding: 8, color: "var(--text-muted)" }}>
                    <bdi>{p.roleTitle}</bdi>
                  </td>
                  <td style={{ padding: 8, textAlign: "end", color: tone(p.reading), fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{t("percent", { percent: p.percent })}</td>
                  <td style={{ padding: 8, color: "var(--text-muted)" }}>{format.dateTime(new Date(p.submittedAt), { dateStyle: "medium" })}</td>
                  <td style={{ padding: 8, color: p.timing?.late || (p.timing?.leftPage ?? 0) > 0 ? "var(--amber)" : "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                    {p.timing ? `${formatClock(p.timing.usedSeconds)}${p.timing.late ? ` · ${t("late")}` : ""}${p.timing.leftPage > 0 ? ` · ${t("leftPage", { count: p.timing.leftPage })}` : ""}` : "—"}
                  </td>
                  <td style={{ padding: 8, textAlign: "end" }}>
                    <Link href={`/dashboard/knowledge-check/${p.checkId}`} style={{ color: "var(--teal)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                      {t("open")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ ...muted, marginTop: 12 }}>{t("caution")}</p>
      </div>
    </section>
  );
}
