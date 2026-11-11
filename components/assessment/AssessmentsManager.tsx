"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { assignRoleAssessment, updateAssessmentSettings } from "@/lib/assessment/actions";
import { assignKnowledgeCheck, type KnowledgeCheckListRow } from "@/lib/knowledgeBank/actions";
import type { AssessmentSettings, AssignableEmployee, RoleAssessmentRow } from "@/lib/assessment/types";
import type { PickerRole } from "@/lib/assessment/employeePicker";
import GiveRoleInline from "@/components/assessment/GiveRoleInline";

const card: React.CSSProperties = { background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 };
const muted: React.CSSProperties = { fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 };
const input: React.CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", padding: "8px 10px", fontSize: 13 };
const primaryBtn: React.CSSProperties = { background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" };

type Kind = "check" | "role";

// One place to give someone an assessment: pick the person, pick the kind, assign. Both kinds are listed together below, and
// the settings (rarely changed) are folded away. Replaces the two separate assign boxes.
export default function AssessmentsManager({
  roleRows,
  checkRows,
  checksReady,
  names,
  employees,
  roles,
  viewer,
  settings,
}: {
  roleRows: RoleAssessmentRow[];
  checkRows: KnowledgeCheckListRow[];
  checksReady: boolean;
  names: Record<string, string>;
  employees: AssignableEmployee[];
  roles: PickerRole[];
  viewer: "admin" | "manager";
  settings: AssessmentSettings;
}) {
  const t = useTranslations("assessmentsManager");
  const tr = useTranslations("roleAssessment");
  const tk = useTranslations("knowledgeCheck");
  const format = useFormatter();
  const router = useRouter();
  const [who, setWho] = useState("");
  const [kind, setKind] = useState<Kind>(checksReady ? "check" : "role");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [s, setS] = useState<AssessmentSettings>(settings);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [settingsErr, setSettingsErr] = useState<string | null>(null);
  const [savingSettings, startSettings] = useTransition();

  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });
  const openFor = new Set(checkRows.filter((r) => !r.submittedAt).map((r) => r.employeeUserId));
  const selected = employees.find((e) => e.userId === who);
  const needsRole = !!selected && !selected.roleTitle;
  // Why this person cannot be given this kind right now (shown instead of failing after the click).
  const blocked =
    selected && selected.roleTitle
      ? kind === "role" && selected.availableOn
        ? tr("optionAvailableOn", { date: date(selected.availableOn) })
        : kind === "check" && openFor.has(selected.userId)
          ? tk("optionOpenCheck")
          : null
      : null;
  const noRole = employees.filter((e) => !e.roleTitle).length;
  const eligibleForCheck = employees.filter((e) => e.roleTitle && !e.isSelf && !openFor.has(e.userId));

  function assign() {
    setError(null);
    setMessage(kind === "check" ? tk("assigning") : tr("assigning"));
    startTransition(async () => {
      if (kind === "check") {
        const r = await assignKnowledgeCheck(who);
        if ("error" in r) {
          setMessage(null);
          setError(r.error);
          return;
        }
        setMessage([tk("assignedOk", { count: r.questions }), r.leftOut > 0 ? tk("leftOut", { count: r.leftOut }) : "", r.inEnglish ? tk("inEnglish") : ""].filter(Boolean).join(" "));
      } else {
        const r = await assignRoleAssessment(who);
        if ("error" in r && r.error) {
          setMessage(null);
          setError(r.error);
          return;
        }
        setMessage(tr("assignedOk") + ("leftOut" in r && r.leftOut ? " " + tr("leftOut", { count: r.leftOut, max: s.maxCompetencies }) : ""));
      }
      setWho("");
      router.refresh();
    });
  }

  // Free (no AI): a check is marked in the app. Everyone with a role and no open check gets one in a single step.
  function assignAll() {
    if (!window.confirm(tk("assignAllConfirm", { count: eligibleForCheck.length }))) return;
    setError(null);
    setMessage(tk("assigningAll"));
    startTransition(async () => {
      let ok = 0;
      const failed: string[] = [];
      for (const e of eligibleForCheck) {
        const r = await assignKnowledgeCheck(e.userId);
        if ("error" in r) failed.push(`${e.name}: ${r.error}`);
        else ok += 1;
      }
      setMessage(tk("assignAllDone", { ok, failed: failed.length }));
      if (failed.length > 0) setError(failed.slice(0, 5).join(" · ") + (failed.length > 5 ? " …" : ""));
      router.refresh();
    });
  }

  function saveSettings() {
    setSettingsErr(null);
    setSettingsMsg(null);
    startSettings(async () => {
      const r = await updateAssessmentSettings(s);
      if ("error" in r && r.error) {
        setSettingsErr(r.error);
        return;
      }
      setSettingsMsg(tr("settingsSaved"));
      router.refresh();
    });
  }

  const num = (key: keyof AssessmentSettings, text: string, min: number, max: number) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--text-muted)" }}>
      {text}
      <input type="number" min={min} max={max} value={s[key] as number} onChange={(e) => setS((p) => ({ ...p, [key]: Number(e.target.value) }))} style={{ ...input, width: 120 }} />
    </label>
  );

  // Both kinds in one list, newest first.
  const items = [
    ...roleRows.map((r) => ({
      key: `r-${r.id}`,
      kind: "role" as const,
      employeeUserId: r.employeeUserId,
      roleTitle: r.roleTitle,
      detail: tr("competencyCount", { count: r.competencyCount }),
      createdAt: r.createdAt,
      status: tr(`status_${r.status}`),
      done: r.status === "scored",
      href: `/dashboard/role-assessment/${r.id}`,
    })),
    ...checkRows.map((r) => ({
      key: `c-${r.id}`,
      kind: "check" as const,
      employeeUserId: r.employeeUserId,
      roleTitle: r.roleTitle,
      detail: tk("questionCount", { count: r.questionCount }),
      createdAt: r.createdAt,
      status: r.submittedAt ? `${tk("done")} · ${tk("score", { percent: r.percent ?? 0 })}` : tk("waiting"),
      done: !!r.submittedAt,
      href: `/dashboard/knowledge-check/${r.id}`,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const kindCard = (value: Kind, title: string, body: string, disabled = false) => (
    <label
      key={value}
      style={{
        flex: "1 1 260px",
        display: "flex",
        gap: 10,
        padding: 12,
        borderRadius: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        border: `1px solid ${kind === value ? "var(--teal)" : "var(--border)"}`,
        background: kind === value ? "rgba(255,255,255,0.04)" : "transparent",
      }}
    >
      <input type="radio" name="assessment-kind" checked={kind === value} disabled={disabled} onChange={() => setKind(value)} style={{ marginTop: 3 }} />
      <span>
        <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{title}</span>
        <span style={{ display: "block", ...muted, marginTop: 2 }}>{body}</span>
      </span>
    </label>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={card}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t("title")}</h2>

        <p style={{ ...label, margin: "14px 0 6px" }}>{t("whoLabel")}</p>
        <select value={who} onChange={(e) => setWho(e.target.value)} style={{ ...input, minWidth: 280, maxWidth: "100%" }} aria-label={t("whoLabel")}>
          <option value="">{tr("chooseEmployee")}</option>
          {employees.map((e) => (
            <option key={e.userId} value={e.userId}>
              {e.name}{e.isSelf ? ` ${tr("youSuffix")}` : ""} — {e.roleTitle ?? tr("optionNoRole")}
            </option>
          ))}
        </select>
        {noRole > 0 && !needsRole && <p style={{ ...muted, marginTop: 6 }}>{tr("noRoleNote", { count: noRole })}</p>}
        {needsRole && selected && <GiveRoleInline name={selected.name} memberId={selected.memberId} roles={roles} isAdmin={viewer === "admin"} />}

        <p style={{ ...label, margin: "16px 0 6px" }}>{t("kindLabel")}</p>
        <div role="radiogroup" aria-label={t("kindLabel")} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {kindCard("check", t("kindCheckTitle"), checksReady ? t("kindCheckBody") : t("kindCheckUnavailable"), !checksReady)}
          {kindCard("role", t("kindRoleTitle"), t("kindRoleBody"))}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" style={{ ...primaryBtn, opacity: !who || needsRole || !!blocked || pending ? 0.6 : 1 }} disabled={!who || needsRole || !!blocked || pending} onClick={assign}>
            {t("assignButton")}
          </button>
          {kind === "check" && checksReady && eligibleForCheck.length > 1 && (
            <button type="button" style={{ ...primaryBtn, background: "transparent", color: "var(--teal)", border: "1px solid var(--teal)", opacity: pending ? 0.6 : 1 }} disabled={pending} onClick={assignAll}>
              {tk("assignAll", { count: eligibleForCheck.length })}
            </button>
          )}
          {blocked && <span style={{ fontSize: 12, color: "var(--amber)" }}>{blocked}</span>}
        </div>
        {message && (
          <p role="status" style={{ ...muted, marginTop: 8, color: "var(--teal)" }}>
            {message}
          </p>
        )}
        {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{error}</p>}
      </div>

      <div style={card}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t("listTitle")}</h2>
        {items.length === 0 ? (
          <p style={{ ...muted, marginTop: 10 }}>{t("empty")}</p>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <th style={{ padding: "6px 8px", textAlign: "start" }}>{tr("employee")}</th>
                  <th style={{ padding: "6px 8px", textAlign: "start" }}>{t("colType")}</th>
                  <th style={{ padding: "6px 8px", textAlign: "start" }}>{tr("role")}</th>
                  <th style={{ padding: "6px 8px", textAlign: "start" }}>{tr("status")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.key} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: 8, color: "var(--text)" }}>{names[r.employeeUserId] ?? "—"}</td>
                    <td style={{ padding: 8, color: "var(--text-muted)" }}>{r.kind === "check" ? t("typeCheck") : t("typeRole")}</td>
                    <td style={{ padding: 8, color: "var(--text-muted)" }}>
                      <bdi>{r.roleTitle}</bdi> · {r.detail} · {date(r.createdAt)}
                    </td>
                    <td style={{ padding: 8, color: r.done ? "var(--teal)" : "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{r.status}</td>
                    <td style={{ padding: 8, textAlign: "end" }}>
                      <Link href={r.href} style={{ color: "var(--teal)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                        {tr("open")}
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
        <details style={card}>
          <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{t("settingsToggle")}</summary>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
            {num("itemsPerCompetency", tr("itemsPerCompetency"), 1, 10)}
            {num("maxCompetencies", tr("maxCompetencies"), 1, 30)}
            {num("retentionMonths", tr("retention"), 1, 120)}
            {num("retakeIntervalDays", tr("retake"), 0, 365)}
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--text)", alignSelf: "flex-end" }}>
              <input type="checkbox" checked={s.selfStartAllowed} onChange={(e) => setS((p) => ({ ...p, selfStartAllowed: e.target.checked }))} />
              {tr("selfStart")}
            </label>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
            <button type="button" style={{ ...primaryBtn, opacity: savingSettings ? 0.6 : 1 }} disabled={savingSettings} onClick={saveSettings}>
              {tr("saveSettings")}
            </button>
            {settingsMsg && <span style={{ ...muted, color: "var(--teal)" }}>{settingsMsg}</span>}
            {settingsErr && <span style={{ color: "var(--danger)", fontSize: 12 }}>{settingsErr}</span>}
          </div>
        </details>
      )}
    </div>
  );
}
