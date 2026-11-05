"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { assignKnowledgeCheck, type KnowledgeCheckListRow } from "@/lib/knowledgeBank/actions";

const card: React.CSSProperties = { background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 };
const muted: React.CSSProperties = { fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 };
const input: React.CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", padding: "8px 10px", fontSize: 13 };
const primaryBtn: React.CSSProperties = { background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" };

export default function ManageKnowledgeChecks({
  rows,
  names,
  employees,
  ready,
}: {
  rows: KnowledgeCheckListRow[];
  names: Record<string, string>;
  employees: { userId: string; name: string }[];
  ready: boolean;
}) {
  const t = useTranslations("knowledgeCheck");
  const format = useFormatter();
  const router = useRouter();
  const [who, setWho] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function assign() {
    setError(null);
    setMessage(t("assigning"));
    startTransition(async () => {
      const r = await assignKnowledgeCheck(who);
      if ("error" in r) {
        setMessage(null);
        setError(r.error);
        return;
      }
      setMessage([t("assignedOk", { count: r.questions }), r.leftOut > 0 ? t("leftOut", { count: r.leftOut }) : "", r.inEnglish ? t("inEnglish") : ""].filter(Boolean).join(" "));
      setWho("");
      router.refresh();
    });
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 18 }} aria-labelledby="knowledge-checks-title">
      <div style={card}>
        <h2 id="knowledge-checks-title" style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>
          {t("assignTitle")}
        </h2>
        <p style={{ ...muted, marginTop: 6, maxWidth: 680 }}>{t("assignIntro")}</p>
        {!ready && <p style={{ fontSize: 13, color: "var(--amber)", marginTop: 8 }}>{t("needsMigration")}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
          <select value={who} onChange={(e) => setWho(e.target.value)} style={{ ...input, minWidth: 240 }} aria-label={t("chooseEmployee")} disabled={!ready}>
            <option value="">{t("chooseEmployee")}</option>
            {employees.map((e) => (
              <option key={e.userId} value={e.userId}>
                {e.name}
              </option>
            ))}
          </select>
          <button type="button" style={{ ...primaryBtn, opacity: !who || pending || !ready ? 0.6 : 1 }} disabled={!who || pending || !ready} onClick={assign}>
            {t("assign")}
          </button>
        </div>
        {message && (
          <p role="status" style={{ ...muted, marginTop: 8, color: "var(--teal)" }}>
            {message}
          </p>
        )}
        {error && (
          <p role="alert" style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>
            {error}
          </p>
        )}
      </div>

      <div style={card}>
        {rows.length === 0 ? (
          <p style={muted}>{t("noRows")}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <th style={{ padding: "6px 8px", textAlign: "start" }}>{t("employee")}</th>
                  <th style={{ padding: "6px 8px", textAlign: "start" }}>{t("role")}</th>
                  <th style={{ padding: "6px 8px", textAlign: "start" }}>{t("status")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: 8, color: "var(--text)" }}>{names[r.employeeUserId] ?? "—"}</td>
                    <td style={{ padding: 8, color: "var(--text-muted)" }}>
                      {r.roleTitle} · {t("questionCount", { count: r.questionCount })} · {t("createdOn", { date: format.dateTime(new Date(r.createdAt), { dateStyle: "medium" }) })}
                    </td>
                    <td style={{ padding: 8, color: r.submittedAt ? "var(--teal)" : "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                      {r.submittedAt ? `${t("done")} · ${t("score", { percent: r.percent ?? 0 })}` : t("waiting")}
                    </td>
                    <td style={{ padding: 8, textAlign: "end" }}>
                      <Link href={`/dashboard/knowledge-check/${r.id}`} style={{ color: "var(--teal)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                        {t("open")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
