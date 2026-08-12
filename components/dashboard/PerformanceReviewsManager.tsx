"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createReviewCycle, updateCycleStatus, listReviewCycles, listReviewsForCycle } from "@/lib/performanceReviews/actions";
import { listWorkflowTemplates, cloneStarterTemplate, listOrganizationMembersForAssignment } from "@/lib/performanceReviews/workflowActions";
import { STARTER_KEYS, STARTER_TEMPLATES } from "@/lib/performanceReviews/starterTemplates";
import { describeCycleTimeline, TIMELINE_TONE_COLOR } from "@/lib/performanceReviews/timeline";
import ImpactCycleReviewRow from "@/components/dashboard/ImpactCycleReviewRow";
import type { PerformanceReviewCycle, ReviewListItem } from "@/lib/performanceReviews/types";
import type { WorkflowTemplate } from "@/lib/performanceReviews/workflowTypes";

const CYCLE_STATUS_COLOR: Record<string, string> = {
  draft: "148,163,184",
  open: "0,201,167",
  closed: "148,163,184",
};

function inputStyle(): React.CSSProperties {
  return {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 13,
    color: "var(--text)",
    outline: "none",
    width: "100%",
  };
}

function CreateCycleForm({ organizationId, onCreated }: { organizationId: string; onCreated: () => void }) {
  const t = useTranslations("performanceReviewsManager");
  const tStarters = useTranslations("workflowStarterTemplates");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [templateChoice, setTemplateChoice] = useState("");
  const [existingTemplates, setExistingTemplates] = useState<WorkflowTemplate[]>([]);
  const [scopeMode, setScopeMode] = useState<"all" | "specific">("all");
  const [roster, setRoster] = useState<{ userId: string; name: string; email: string }[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    listWorkflowTemplates(organizationId).then(setExistingTemplates);
    listOrganizationMembersForAssignment(organizationId).then(setRoster);
  }, [open, organizationId]);

  function toggleEmployee(userId: string) {
    setSelectedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (scopeMode === "specific" && selectedEmployees.size === 0) {
      setError(t("selectAtLeastOneEmployee"));
      return;
    }
    startTransition(async () => {
      let workflowTemplateId: string | null = null;
      if (templateChoice.startsWith("starter:")) {
        const starterKey = templateChoice.slice("starter:".length) as keyof typeof STARTER_TEMPLATES;
        const cloneResult = await cloneStarterTemplate(organizationId, starterKey, `${name || STARTER_TEMPLATES[starterKey].labelKey} workflow`);
        if ("error" in cloneResult) {
          setError(cloneResult.error);
          return;
        }
        workflowTemplateId = cloneResult.template.id;
      } else if (templateChoice.startsWith("existing:")) {
        workflowTemplateId = templateChoice.slice("existing:".length);
      }

      const employeeUserIds = scopeMode === "specific" ? [...selectedEmployees] : null;
      const result = await createReviewCycle(name, opensAt, closesAt, workflowTemplateId, employeeUserIds);
      if (result?.error) setError(result.error);
      else {
        setName("");
        setOpensAt("");
        setClosesAt("");
        setTemplateChoice("");
        setScopeMode("all");
        setSelectedEmployees(new Set());
        setOpen(false);
        onCreated();
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ background: "rgba(var(--teal-rgb),0.1)", border: "1px solid rgba(var(--teal-rgb),0.3)", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "var(--teal)", cursor: "pointer" }}
      >
        {t("newImpactCycle")}
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, display: "block" }}>{t("cycleNameLabel")}</label>
        <input style={inputStyle()} value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder={t("cycleNamePlaceholder")} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, display: "block" }}>{t("opens")}</label>
          <input type="date" style={inputStyle()} value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, display: "block" }}>{t("closes")}</label>
          <input type="date" style={inputStyle()} value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
        </div>
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, display: "block" }}>{t("workflowLabel")}</label>
        <select value={templateChoice} onChange={(e) => setTemplateChoice(e.target.value)} style={{ ...inputStyle(), cursor: "pointer" }}>
          <option value="">{t("workflowOrgDefault")}</option>
          <optgroup label={t("workflowStartersGroup")}>
            {STARTER_KEYS.map((key) => (
              <option key={key} value={`starter:${key}`}>
                {tStarters(STARTER_TEMPLATES[key].labelKey)}
              </option>
            ))}
          </optgroup>
          {existingTemplates.length > 0 && (
            <optgroup label={t("workflowSavedGroup")}>
              {existingTemplates.map((tpl) => (
                <option key={tpl.id} value={`existing:${tpl.id}`}>
                  {tpl.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, display: "block" }}>{t("cycleScopeLabel")}</label>
        <div style={{ display: "flex", gap: 6, marginBottom: scopeMode === "specific" ? 10 : 0 }}>
          {(["all", "specific"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setScopeMode(mode)}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 999,
                border: scopeMode === mode ? "1px solid var(--teal)" : "1px solid var(--border)",
                background: scopeMode === mode ? "rgba(var(--teal-rgb),0.1)" : "transparent",
                color: scopeMode === mode ? "var(--teal)" : "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              {mode === "all" ? t("cycleScopeAll") : t("cycleScopeSpecific")}
            </button>
          ))}
        </div>
        {scopeMode === "specific" && (
          <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {roster.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("cycleScopeNoEmployees")}</p>
            ) : (
              roster.map((m) => (
                <label key={m.userId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text)", cursor: "pointer", padding: "3px 4px" }}>
                  <input type="checkbox" checked={selectedEmployees.has(m.userId)} onChange={() => toggleEmployee(m.userId)} />
                  {m.name}
                </label>
              ))
            )}
          </div>
        )}
      </div>
      {error && <p style={{ color: "var(--danger)", fontSize: 12 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={isPending} style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}>
          {isPending ? t("creating") : t("create")}
        </button>
        <button type="button" onClick={() => setOpen(false)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}

function cycleStatusLabel(t: (key: string) => string, status: "draft" | "open" | "closed"): string {
  return t(`cycleStatus${status.charAt(0).toUpperCase()}${status.slice(1)}`);
}

export default function PerformanceReviewsManager({ initialCycles, organizationId }: { initialCycles: PerformanceReviewCycle[]; organizationId: string }) {
  const t = useTranslations("performanceReviewsManager");
  const [cycles, setCycles] = useState(initialCycles);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(initialCycles[0]?.id ?? null);
  const [reviews, setReviews] = useState<ReviewListItem[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [, startTransition] = useTransition();

  async function loadReviews(cycleId: string) {
    setLoadingReviews(true);
    const items = await listReviewsForCycle(cycleId);
    setReviews(items);
    setLoadingReviews(false);
  }

  function selectCycle(cycleId: string) {
    setSelectedCycleId(cycleId);
    loadReviews(cycleId);
  }

  function refreshCycles() {
    startTransition(async () => {
      const { cycles: next } = await listReviewCycles();
      setCycles(next);
      if (next[0] && !selectedCycleId) selectCycle(next[0].id);
    });
  }

  const selectedCycle = cycles.find((c) => c.id === selectedCycleId) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <CreateCycleForm organizationId={organizationId} onCreated={refreshCycles} />
      </div>

      {cycles.length === 0 ? (
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{t("noneYet")}</p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {cycles.map((c) => {
              const color = CYCLE_STATUS_COLOR[c.status];
              const active = c.id === selectedCycleId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectCycle(c.id)}
                  style={{
                    background: active ? `rgba(${color},0.14)` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${active ? `rgba(${color},0.4)` : "var(--border)"}`,
                    borderRadius: 10,
                    padding: "8px 14px",
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: active ? `rgb(${color})` : "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  {c.name} · {cycleStatusLabel(t, c.status)}
                </button>
              );
            })}
          </div>

          {selectedCycle && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("cycleStatusPrefix")}</span>
              {(["draft", "open", "closed"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={selectedCycle.status === s}
                  onClick={() =>
                    startTransition(async () => {
                      await updateCycleStatus(selectedCycle.id, s);
                      refreshCycles();
                    })
                  }
                  style={{
                    background: "none",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 11,
                    color: selectedCycle.status === s ? "var(--teal)" : "var(--text-muted)",
                    fontWeight: selectedCycle.status === s ? 700 : 500,
                    cursor: selectedCycle.status === s ? "default" : "pointer",
                    opacity: selectedCycle.status === s ? 1 : 0.7,
                  }}
                >
                  {cycleStatusLabel(t, s)}
                </button>
              ))}
              {(() => {
                const timeline = describeCycleTimeline(selectedCycle.opens_at, selectedCycle.closes_at);
                return timeline ? (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: TIMELINE_TONE_COLOR[timeline.tone] }}>
                    {t(`cycleTimeline.${timeline.key}`, { days: timeline.days })}
                  </span>
                ) : null;
              })()}
            </div>
          )}

          {loadingReviews ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("loading")}</p>
          ) : reviews.length === 0 ? (
            <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{t("noEmployeesInCycle")}</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {reviews.map((item) => (
                <ImpactCycleReviewRow key={item.id} item={item} onChanged={() => selectedCycleId && loadReviews(selectedCycleId)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
