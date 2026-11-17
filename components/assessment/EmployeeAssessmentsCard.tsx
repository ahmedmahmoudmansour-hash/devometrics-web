"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import type { EmployeeAssessmentItem } from "@/lib/assessment/employeeHistory";

const card: React.CSSProperties = { background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 };

// One place on a person's page showing every knowledge check and role assessment they have, with a single button to give them
// another (it opens the assign screen with this person already chosen).
export default function EmployeeAssessmentsCard({ userId, name, items }: { userId: string; name: string; items: EmployeeAssessmentItem[] }) {
  const t = useTranslations("employeeAssessments");
  const tr = useTranslations("roleAssessment");
  const tk = useTranslations("knowledgeCheck");
  const format = useFormatter();

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t("title")}</h3>
        <Link
          href={`/dashboard/company/role-assessments?person=${encodeURIComponent(userId)}`}
          style={{ background: "var(--teal)", color: "#0A0F1E", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
        >
          {t("assign")}
        </Link>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>{t("intro", { name })}</p>

      {items.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 12 }}>{t("empty")}</p>
      ) : (
        <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "flex", flexDirection: "column" }}>
          {items.map((i) => (
            <li key={i.key} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap", borderTop: "1px solid var(--border)", padding: "9px 0", fontSize: 13 }}>
              <span style={{ color: "var(--text)" }}>
                {i.kind === "check" ? t("typeCheck") : t("typeRole")}
                <span style={{ color: "var(--text-muted)", marginInlineStart: 8, fontSize: 12 }}>
                  <bdi>{i.roleTitle}</bdi> · {format.dateTime(new Date(i.createdAt), { dateStyle: "medium" })}
                </span>
              </span>
              <span style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
                <span style={{ color: i.kind === "check" ? (i.done ? "var(--teal)" : "var(--text-muted)") : i.status === "scored" ? "var(--teal)" : "var(--text-muted)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {i.kind === "check" ? (i.done ? tk("score", { percent: i.percent ?? 0 }) : tk("waiting")) : tr(`status_${i.status}`)}
                </span>
                <Link href={i.href} style={{ color: "var(--teal)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                  {tr("open")}
                </Link>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
