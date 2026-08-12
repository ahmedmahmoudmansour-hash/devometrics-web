"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createSuccessionRole,
  deleteSuccessionRole,
  generateSuccessionReport,
  nominateForRole,
  removeNomination,
} from "@/lib/succession/actions";
import { ScoreBar, NineBoxGrid, NineBoxLegend } from "@/components/dashboard/charts";
import type { SuccessionRole, SuccessionNomination } from "@/lib/supabase/types";
import type { ReadinessForecast } from "@/lib/succession/forecast";

type Translator = (key: string, values?: Record<string, string | number>) => string;

function forecastText(t: Translator, forecast: ReadinessForecast | undefined): string | null {
  if (!forecast) return null;
  if (forecast.status === "insufficient_data") {
    return t("insufficientForecastData");
  }
  if (forecast.status === "declining") {
    return t("trendingDown");
  }
  if (forecast.readyNow) return null; // "Ready now" already says this
  if (forecast.monthsToReady > 36) {
    return t("trendOverThreeYears", { trend: forecast.trendPerMonth });
  }
  return t("trendProjected", { trend: forecast.trendPerMonth, months: forecast.monthsToReady });
}

function NominationPanel({
  roleId,
  employees,
  nominations,
  excludeUserIds,
}: {
  roleId: string;
  employees: { userId: string; name: string }[];
  nominations: SuccessionNomination[];
  excludeUserIds: Set<string>;
}) {
  const t = useTranslations("successionBoard");
  const [adding, setAdding] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const available = employees.filter((e) => !excludeUserIds.has(e.userId));

  function add() {
    if (!employeeId) return setError(t("pickSomeoneToNominate"));
    setError(null);
    startTransition(async () => {
      const result = await nominateForRole(roleId, employeeId, note);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEmployeeId("");
      setNote("");
      setAdding(false);
      router.refresh();
    });
  }

  function remove(nominationId: string) {
    startTransition(async () => {
      await removeNomination(nominationId);
      router.refresh();
    });
  }

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 14 }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
        {t("manuallyNominated")}
      </p>
      {nominations.length === 0 && !adding && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
          {t("noNominationsYet")}
        </p>
      )}
      {nominations.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {nominations.map((n) => {
            const person = employees.find((e) => e.userId === n.employee_user_id);
            return (
              <div key={n.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, fontSize: 12.5 }}>
                <div>
                  <span style={{ color: "var(--text)", fontWeight: 700 }}>{person?.name ?? t("formerMember")}</span>
                  {n.note && <span style={{ color: "var(--text-muted)" }}> — {n.note}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => remove(n.id)}
                  disabled={isPending}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11.5, cursor: "pointer", flexShrink: 0 }}
                >
                  {t("remove")}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {adding ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            aria-label={t("employeeToNominate")}
            style={{ ...fieldStyle, padding: "8px 12px", fontSize: 13 }}
          >
            <option value="">{t("chooseAnEmployee")}</option>
            {available.map((e) => (
              <option key={e.userId} value={e.userId}>
                {e.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("nominationNotePlaceholder")}
            aria-label={t("nominationNoteLabel")}
            style={{ ...fieldStyle, padding: "8px 12px", fontSize: 13 }}
          />
          {error && <p style={{ color: "var(--danger)", fontSize: 12 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={add}
              disabled={isPending}
              style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              {isPending ? t("nominating") : t("nominate")}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px", fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={available.length === 0}
          style={{ background: "none", border: "1px solid rgba(var(--teal-rgb),0.3)", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, color: "var(--teal)", cursor: available.length === 0 ? "not-allowed" : "pointer", opacity: available.length === 0 ? 0.5 : 1 }}
        >
          {t("nominateSomeone")}
        </button>
      )}
    </div>
  );
}

// Same 3-bucket boundaries readinessColor() already uses for the pipeline
// counts and dot colors — reused here as a Y-axis position so the grid
// can't disagree with the badges sitting right next to it. Oriented so
// "ready now" plots highest: this is the honest way to show "who has more
// runway toward this role" from data we actually have (fit + a readiness
// bucket), without inventing a separate "potential" score the AI never
// produced.
function readinessToY(readiness: string): number {
  const r = readiness.toLowerCase();
  if (r.includes("ready now")) return 95;
  if (r.includes("month")) return 58;
  return 25;
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
  fontFamily: "inherit",
};

function readinessColor(readiness: string): string {
  const r = readiness.toLowerCase();
  if (r.includes("ready now")) return "var(--teal)";
  if (r.includes("month")) return "var(--amber)";
  return "var(--phase2)";
}

function RoleCard({
  role,
  employeeCount,
  employees,
  nominations,
  forecastsByUserId,
}: {
  role: SuccessionRole;
  employeeCount: number;
  employees: { userId: string; name: string }[];
  nominations: SuccessionNomination[];
  forecastsByUserId: Record<string, ReadinessForecast>;
}) {
  const t = useTranslations("successionBoard");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await generateSuccessionReport(role.id);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteSuccessionRole(role.id);
      router.refresh();
    });
  }

  const report = role.report;
  const readyNow = report?.candidates.filter((c) => c.readiness.toLowerCase().includes("ready now")).length ?? 0;
  const nearReady = report?.candidates.filter((c) => c.readiness.toLowerCase().includes("month")).length ?? 0;
  const developing = report ? report.candidates.length - readyNow - nearReady : 0;

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{role.title}</h2>
          {role.description && (
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.6, maxWidth: 520 }}>
              {role.description}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={generate}
            disabled={isPending}
            style={{
              background: "rgba(var(--teal-rgb),0.1)",
              border: "1px solid rgba(var(--teal-rgb),0.3)",
              borderRadius: 8,
              padding: "7px 14px",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--teal)",
              cursor: "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? t("analyzing") : report ? t("reRunAnalysis") : t("runAiAnalysis")}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={isPending}
            style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}
          >
            {t("delete")}
          </button>
        </div>
      </div>

      {error && <p style={{ color: "var(--danger)", fontSize: 12.5, marginTop: 10 }}>{error}</p>}

      <div style={{ marginTop: 14 }}>
        <NominationPanel
          roleId={role.id}
          employees={employees}
          nominations={nominations}
          excludeUserIds={new Set(nominations.map((n) => n.employee_user_id))}
        />
      </div>

      {!report && !error && (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 12 }}>
          {t("noAnalysisYet", { count: employeeCount })}
        </p>
      )}

      {report && (
        <div style={{ marginTop: 16 }}>
          {/* Bench strength pipeline */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--teal)", background: "rgba(var(--teal-rgb),0.1)", border: "1px solid rgba(var(--teal-rgb),0.3)", borderRadius: 999, padding: "4px 12px" }}>
              {t("readyNow", { count: readyNow })}
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--amber)", background: "rgba(var(--amber-rgb),0.08)", border: "1px solid rgba(var(--amber-rgb),0.3)", borderRadius: 999, padding: "4px 12px" }}>
              {t("nearReady", { count: nearReady })}
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--phase2)", background: "rgba(var(--phase2-rgb),0.08)", border: "1px solid rgba(var(--phase2-rgb),0.3)", borderRadius: 999, padding: "4px 12px" }}>
              {t("developing", { count: developing })}
            </span>
            {!report.hasStrongSuccessor && (
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--danger)", background: "rgba(var(--danger-rgb),0.08)", border: "1px solid rgba(var(--danger-rgb),0.3)", borderRadius: 999, padding: "4px 12px" }}>
                {t("noStrongSuccessor")}
              </span>
            )}
          </div>

          {report.riskNote && (
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 14, borderInlineStart: "2px solid var(--amber)", paddingInlineStart: 10 }}>
              {report.riskNote}
            </p>
          )}

          {report.candidates.length > 0 && (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 14, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-muted)", alignSelf: "flex-start", marginBottom: 8 }}>
                {t("fitVsReadiness")}
              </p>
              <NineBoxGrid
                points={report.candidates.map((c) => ({ name: c.name, x: c.fitScore, y: readinessToY(c.readiness) }))}
                xLabel={t("fitForThisRole")}
                yLabel={t("readiness")}
                size={300}
              />
              <div style={{ alignSelf: "flex-start", width: "100%" }}>
                <NineBoxLegend />
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {report.candidates.length === 0 && (
              <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                {t("noPlausibleCandidates")}
              </p>
            )}
            {report.candidates.map((c, i) => (
              <div key={c.userId} style={{ background: "rgba(255,255,255,0.03)", border: i === 0 ? "1px solid rgba(var(--teal-rgb),0.3)" : "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
                    {i + 1}. {c.name}
                    {c.nominated && (
                      <span style={{ fontSize: 9.5, fontWeight: 800, color: "var(--teal)", background: "rgba(var(--teal-rgb),0.1)", border: "1px solid rgba(var(--teal-rgb),0.3)", borderRadius: 999, padding: "3px 9px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {t("nominatedByYou")}
                      </span>
                    )}
                  </p>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: readinessColor(c.readiness), whiteSpace: "nowrap" }}>
                    {c.readiness}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 44px", alignItems: "center", gap: 10, marginTop: 8 }}>
                  <ScoreBar value={c.fitScore} color={readinessColor(c.readiness)} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: readinessColor(c.readiness) }}>{c.fitScore}</span>
                </div>
                {forecastText(t, forecastsByUserId[c.userId]) && (
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
                    ↗ {forecastText(t, forecastsByUserId[c.userId])}
                  </p>
                )}
                <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 8 }}>{c.whyRanked}</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginTop: 10 }}>
                  {c.strengths.length > 0 && (
                    <div>
                      <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--teal)", marginBottom: 3 }}>{t("strengths")}</p>
                      {c.strengths.map((s) => (
                        <p key={s} style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.55 }}>+ {s}</p>
                      ))}
                    </div>
                  )}
                  {c.gaps.length > 0 && (
                    <div>
                      <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--amber)", marginBottom: 3 }}>{t("gaps")}</p>
                      {c.gaps.map((g) => (
                        <p key={g} style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.55 }}>− {g}</p>
                      ))}
                    </div>
                  )}
                </div>
                <p style={{ fontSize: 12, color: "var(--text)", marginTop: 10 }}>
                  <strong style={{ color: "var(--teal)" }}>{t("developmentFocus")}</strong> {c.developmentFocus}
                </p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10 }}>
            {t("generatedOn", {
              date: new Date(report.generatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
            })}
          </p>
        </div>
      )}
    </div>
  );
}

export default function SuccessionBoard({
  roles,
  employeeCount,
  employees,
  nominationsByRole,
  forecastsByUserId,
}: {
  roles: SuccessionRole[];
  employeeCount: number;
  employees: { userId: string; name: string }[];
  nominationsByRole: Record<string, SuccessionNomination[]>;
  forecastsByUserId: Record<string, ReadinessForecast>;
}) {
  const t = useTranslations("successionBoard");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function create() {
    setError(null);
    startTransition(async () => {
      const result = await createSuccessionRole(title, description);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setTitle("");
      setDescription("");
      setCreating(false);
      router.refresh();
    });
  }

  const analyzed = roles.filter((r) => r.report);
  const needsAttention = analyzed.filter((r) => r.report && !r.report.hasStrongSuccessor);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, maxWidth: 640 }}>
        {t("intro")}
      </p>

      {roles.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", borderRadius: 999, padding: "5px 14px" }}>
            {t("rolesDefinedCount", { count: roles.length })}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", borderRadius: 999, padding: "5px 14px" }}>
            {t("analyzedCount", { count: analyzed.length })}
          </span>
          {needsAttention.length > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--danger)", background: "rgba(var(--danger-rgb),0.08)", border: "1px solid rgba(var(--danger-rgb),0.3)", borderRadius: 999, padding: "5px 14px" }}>
              {t("needsAttentionCount", { count: needsAttention.length })}
            </span>
          )}
        </div>
      )}

      {creating ? (
        <div style={{ background: "var(--navy-mid)", border: "1px solid rgba(var(--teal-rgb),0.3)", borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("roleTitlePlaceholder")}
            aria-label={t("roleTitleLabel")}
            style={fieldStyle}
            autoFocus
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("roleRequirementsPlaceholder")}
            aria-label={t("roleRequirementsLabel")}
            rows={4}
            style={{ ...fieldStyle, resize: "vertical" }}
          />
          {error && <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={create}
              disabled={isPending}
              style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
            >
              {isPending ? t("creating") : t("createRole")}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", alignSelf: "flex-start" }}
        >
          {t("defineACriticalRole")}
        </button>
      )}

      {roles.length === 0 && !creating && (
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
            {t("emptyState")}
          </p>
        </div>
      )}

      {roles.map((role) => (
        <RoleCard
          key={role.id}
          role={role}
          employeeCount={employeeCount}
          employees={employees}
          nominations={nominationsByRole[role.id] ?? []}
          forecastsByUserId={forecastsByUserId}
        />
      ))}

      <details style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px" }}>
        <summary style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", cursor: "pointer" }}>
          {t("methodologyDisclosure")}
        </summary>
        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7, marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <p>{t("methodologyP1")}</p>
          <p>{t("methodologyP2")}</p>
        </div>
      </details>
    </div>
  );
}
