"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import PrintReportBar from "@/components/assessment/PrintReportBar";
import type { Ladder } from "@/lib/jobArchitecture/ladder";

const card: React.CSSProperties = { background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginBottom: 18 };

// The company's job architecture as a picture: families across, grades down, every role where it sits and how many people hold it.
// A row with nothing in it is a missing step on the ladder. Below it, how many people are at each level. Printable.
export default function CareerLadderChart({ ladder }: { ladder: Ladder }) {
  const t = useTranslations("careerLadder");
  if (ladder.families.length === 0) return null;
  const cols = ladder.families.length;

  return (
    <section className="print-plan" style={card} aria-labelledby="career-ladder-title">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <h2 id="career-ladder-title" style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t("title")}</h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5, maxWidth: 680 }}>{t("intro")}</p>
        </div>
        <PrintReportBar />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "12px 0", fontSize: 12, color: "var(--text-muted)" }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "var(--teal)", marginInlineEnd: 6 }} />{t("legendIc")}</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "var(--amber)", marginInlineEnd: 6 }} />{t("legendManagement")}</span>
        <span>{t("legendCount")}</span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: `130px repeat(${cols}, minmax(170px, 1fr))`, gap: 6, minWidth: 130 + cols * 176 }}>
          <div />
          {ladder.families.map((f) => (
            <div key={f.id} style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", padding: "4px 6px" }}><bdi>{f.name}</bdi></div>
          ))}
          {ladder.grades.map((g) => (
            <div key={g.grade} style={{ display: "contents" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 6px", borderTop: "1px solid var(--border)" }}>
                <strong style={{ color: "var(--text)" }}>{t("gradeLabel", { grade: g.grade })}</strong>
                {g.label && <div><bdi>{g.label}</bdi></div>}
                {g.roles === 0 && <div style={{ color: "var(--amber)" }}>{t("noRoleHere")}</div>}
              </div>
              {ladder.families.map((f) => {
                const list = ladder.cells[f.id]?.[g.grade] ?? [];
                return (
                  <div key={f.id} style={{ borderTop: "1px solid var(--border)", padding: 4, display: "flex", flexDirection: "column", gap: 4, minHeight: 36 }}>
                    {list.map((r) => (
                      <div
                        key={r.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                          alignItems: "baseline",
                          fontSize: 12,
                          color: "var(--text)",
                          border: `1px solid ${r.track === "management" ? "var(--amber)" : "var(--teal)"}`,
                          background: r.people > 0 ? "rgba(128,128,128,0.10)" : "transparent",
                          borderRadius: 8,
                          padding: "5px 8px",
                        }}
                        title={r.track === "management" ? t("legendManagement") : t("legendIc")}
                      >
                        <span style={{ opacity: r.people > 0 ? 1 : 0.65 }}><bdi>{r.title}</bdi></span>
                        <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: r.people > 0 ? "var(--text)" : "var(--text-muted)" }}>{r.people}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "22px 0 4px" }}>{t("byLevel")}</h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{t("placed", { placed: ladder.placedPeople, unplaced: ladder.unplacedPeople })}</p>
      <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {ladder.grades.map((g) => (
          <li key={g.grade} style={{ display: "grid", gridTemplateColumns: "110px 1fr 40px", gap: 10, alignItems: "center", fontSize: 12 }}>
            <span style={{ color: "var(--text-muted)" }}>{t("gradeLabel", { grade: g.grade })}{g.label ? ` · ${g.label}` : ""}</span>
            <span style={{ height: 10, borderRadius: 5, background: "rgba(128,128,128,0.18)", overflow: "hidden" }} role="img" aria-label={t("barLabel", { grade: g.grade, people: g.people })}>
              <span style={{ display: "block", height: "100%", width: ladder.maxPeopleInAGrade > 0 ? `${(g.people / ladder.maxPeopleInAGrade) * 100}%` : 0, background: "var(--teal)", borderRadius: 5 }} />
            </span>
            <span style={{ textAlign: "end", fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{g.people}</span>
          </li>
        ))}
      </ul>
      {ladder.unplacedPeople > 0 && (
        <p className="no-print" style={{ fontSize: 12, marginTop: 12 }}>
          <Link href="/dashboard/company/employees" style={{ color: "var(--teal)", fontWeight: 700, textDecoration: "none" }}>{t("placeThem")}</Link>
        </p>
      )}
    </section>
  );
}
