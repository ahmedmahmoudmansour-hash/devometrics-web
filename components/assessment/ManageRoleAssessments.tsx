"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { assignRoleAssessment, updateAssessmentSettings } from "@/lib/assessment/actions";
import type { AssessmentSettings, AssignableEmployee, RoleAssessmentRow } from "@/lib/assessment/types";

const card: React.CSSProperties = { background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 };
const muted: React.CSSProperties = { fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 };
const input: React.CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", padding: "8px 10px", fontSize: 13 };
const primaryBtn: React.CSSProperties = { background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" };

export default function ManageRoleAssessments({
  rows,
  names,
  employees,
  viewer,
  settings,
}: {
  rows: RoleAssessmentRow[];
  names: Record<string, string>;
  employees: AssignableEmployee[];
  viewer: "admin" | "manager";
  settings: AssessmentSettings;
}) {
  const t = useTranslations("roleAssessment");
  const format = useFormatter();
  const router = useRouter();
  const noRole = employees.filter((e) => !e.roleTitle).length;
  const [who, setWho] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [s, setS] = useState<AssessmentSettings>(settings);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [settingsErr, setSettingsErr] = useState<string | null>(null);
  const [savingSettings, startSettings] = useTransition();

  function assign() {
    setError(null);
    setMessage(t("assigning"));
    startTransition(async () => {
      const r = await assignRoleAssessment(who);
      if ("error" in r && r.error) { setMessage(null); setError(r.error); return; }
      setMessage(t("assignedOk") + (("leftOut" in r && r.leftOut) ? " " + t("leftOut", { count: r.leftOut, max: s.maxCompetencies }) : ""));
      setWho("");
      router.refresh();
    });
  }
  function saveSettings() {
    setSettingsErr(null);
    setSettingsMsg(null);
    startSettings(async () => {
      const r = await updateAssessmentSettings(s);
      if ("error" in r && r.error) { setSettingsErr(r.error); return; }
      setSettingsMsg(t("settingsSaved"));
      router.refresh();
    });
  }

  const num = (key: keyof AssessmentSettings, label: string, min: number, max: number) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--text-muted)" }}>
      {label}
      <input type="number" min={min} max={max} value={s[key] as number} onChange={(e) => setS((p) => ({ ...p, [key]: Number(e.target.value) }))} style={{ ...input, width: 120 }} />
    </label>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={card}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t("assignTitle")}</h2>
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
          <select value={who} onChange={(e) => setWho(e.target.value)} style={{ ...input, minWidth: 240 }} aria-label={t("chooseEmployee")}>
            <option value="">{t("chooseEmployee")}</option>
            {employees.map((e) => (
              <option key={e.userId} value={e.userId} disabled={!e.roleTitle || !!e.availableOn}>
                {!e.roleTitle
                  ? `${e.name} — ${t("optionNoRole")}`
                  : e.availableOn
                    ? `${e.name} — ${t("optionAvailableOn", { date: format.dateTime(new Date(e.availableOn), { dateStyle: "medium" }) })}`
                    : `${e.name} — ${e.roleTitle}`}
              </option>
            ))}
          </select>
          <button type="button" style={{ ...primaryBtn, opacity: !who || isPending ? 0.6 : 1 }} disabled={!who || isPending} onClick={assign}>
            {t("assign")}
          </button>
        </div>
        {noRole > 0 && (
          <p style={{ ...muted, marginTop: 8 }}>
            {t("noRoleNote", { count: noRole })}{" "}
            {viewer === "admin" && (
              <Link href="/dashboard/company/employees" style={{ color: "var(--teal)", fontWeight: 700, textDecoration: "none" }}>
                {t("setRolesLink")}
              </Link>
            )}
          </p>
        )}
        {message && <p style={{ ...muted, marginTop: 8, color: "var(--teal)" }}>{message}</p>}
        {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{error}</p>}
      </div>

      <div style={card}>
        {rows.length === 0 ? (
          <p style={muted}>{t("noRows")}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "start", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <th style={{ padding: "6px 8px", textAlign: "start" }}>{t("employee")}</th>
                  <th style={{ padding: "6px 8px", textAlign: "start" }}>{t("role")}</th>
                  <th style={{ padding: "6px 8px", textAlign: "start" }}>{t("status")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px", color: "var(--text)" }}>{names[r.employeeUserId] ?? "—"}</td>
                    <td style={{ padding: "8px", color: "var(--text-muted)" }}>
                      {r.roleTitle} · {t("competencyCount", { count: r.competencyCount })}
                    </td>
                    <td style={{ padding: "8px", color: r.status === "scored" ? "var(--teal)" : "var(--text-muted)" }}>{t(`status_${r.status}`)}</td>
                    <td style={{ padding: "8px", textAlign: "end" }}>
                      <Link href={`/dashboard/role-assessment/${r.id}`} style={{ color: "var(--teal)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
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

      {viewer === "admin" && (
        <div style={card}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t("settingsTitle")}</h2>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
            {num("itemsPerCompetency", t("itemsPerCompetency"), 1, 10)}
            {num("maxCompetencies", t("maxCompetencies"), 1, 30)}
            {num("retentionMonths", t("retention"), 1, 120)}
            {num("retakeIntervalDays", t("retake"), 0, 365)}
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--text)", alignSelf: "flex-end" }}>
              <input type="checkbox" checked={s.selfStartAllowed} onChange={(e) => setS((p) => ({ ...p, selfStartAllowed: e.target.checked }))} />
              {t("selfStart")}
            </label>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
            <button type="button" style={{ ...primaryBtn, opacity: savingSettings ? 0.6 : 1 }} disabled={savingSettings} onClick={saveSettings}>
              {t("saveSettings")}
            </button>
            {settingsMsg && <span style={{ ...muted, color: "var(--teal)" }}>{settingsMsg}</span>}
            {settingsErr && <span style={{ color: "var(--danger)", fontSize: 12 }}>{settingsErr}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
