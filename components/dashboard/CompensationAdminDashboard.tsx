"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createSalaryBand,
  deleteSalaryBand,
  setCompensationTerminology,
  decideCompensationProposal,
  proposeCompensationChange,
  setCompensationManagerVisibility,
  type SalaryBand,
  type OrgCompensationRow,
  type CompensationProposal,
  type CompensationManagerVisibility,
} from "@/lib/compensation/actions";
import { COMPENSATION_FIELD_KEYS, compensationFieldLabel, type CompensationFieldKey } from "@/lib/compensation/terminology";

const cardStyle: React.CSSProperties = { background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 };
const fieldStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
  width: "100%",
};
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, display: "block" };
const sectionTitleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 };
const btnPrimary: React.CSSProperties = {
  background: "var(--teal)",
  color: "#0A0F1E",
  border: "none",
  borderRadius: 8,
  padding: "10px 20px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = { background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" };

function formatAmount(amount: number | null, currency: string): string {
  if (amount === null) return "—";
  return `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function CompensationAdminDashboard({
  organizationId,
  initialBands,
  initialTerminology,
  initialRoster,
  initialProposals,
  employeeNames,
  employees,
  initialManagerVisibility,
}: {
  organizationId: string;
  initialBands: SalaryBand[];
  initialTerminology: [string, string][];
  initialRoster: OrgCompensationRow[];
  initialProposals: CompensationProposal[];
  employeeNames: Record<string, { name: string; email: string }>;
  employees: { userId: string; name: string; email: string }[];
  initialManagerVisibility: CompensationManagerVisibility;
}) {
  const t = useTranslations("companyCompensationPage");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Tabs instead of six permanently-stacked cards — an admin visiting this
  // page is almost always here for ONE of "decide something pending",
  // "look someone up", or "change configuration", not all three at once.
  const [activeTab, setActiveTab] = useState<"requests" | "roster" | "settings">("requests");
  const [showProposeForm, setShowProposeForm] = useState(false);

  // --- Manager visibility setting — off (org-wide default 'none') until an
  // admin opts in. Direct RLS write (is_org_admin), same trust level as any
  // other company profile field — see the action's own comment for why this
  // isn't owner-restricted like the Compensation Admin grant.
  const [managerVisibility, setManagerVisibility] = useState<CompensationManagerVisibility>(initialManagerVisibility);
  const [visibilitySaved, setVisibilitySaved] = useState(false);

  function handleVisibilityChange(value: CompensationManagerVisibility) {
    setManagerVisibility(value);
    setVisibilitySaved(false);
    startTransition(async () => {
      const result = await setCompensationManagerVisibility(organizationId, value);
      if (!("error" in result)) {
        setVisibilitySaved(true);
        router.refresh();
      }
    });
  }

  // --- Salary bands ---
  const [bands, setBands] = useState(initialBands);
  const [bandKey, setBandKey] = useState("");
  const [bandName, setBandName] = useState("");
  const [bandCurrency, setBandCurrency] = useState("USD");
  const [bandMin, setBandMin] = useState("");
  const [bandMid, setBandMid] = useState("");
  const [bandMax, setBandMax] = useState("");
  const [bandDeductionAmount, setBandDeductionAmount] = useState("");
  const [bandDeductionNote, setBandDeductionNote] = useState("");
  const [bandError, setBandError] = useState<string | null>(null);

  function handleCreateBand(e: React.FormEvent) {
    e.preventDefault();
    setBandError(null);
    const minAmount = Number(bandMin);
    const maxAmount = Number(bandMax);
    const midAmount = bandMid.trim() === "" ? null : Number(bandMid);
    const defaultMonthlyDeductionAmount = bandDeductionAmount.trim() === "" ? null : Number(bandDeductionAmount);
    if (!Number.isFinite(minAmount) || !Number.isFinite(maxAmount)) return setBandError(t("invalidAmount"));

    startTransition(async () => {
      const result = await createSalaryBand(organizationId, {
        bandKey,
        displayName: bandName,
        currency: bandCurrency,
        minAmount,
        midAmount,
        maxAmount,
        defaultMonthlyDeductionAmount,
        defaultDeductionNote: bandDeductionNote.trim() || null,
      });
      if ("error" in result) {
        setBandError(result.error);
      } else {
        setBands((prev) =>
          [
            ...prev,
            {
              id: result.id,
              bandKey,
              displayName: bandName,
              currency: bandCurrency,
              minAmount,
              midAmount,
              maxAmount,
              defaultMonthlyDeductionAmount,
              defaultDeductionNote: bandDeductionNote.trim() || null,
            },
          ].sort((a, b) => a.minAmount - b.minAmount)
        );
        setBandKey("");
        setBandName("");
        setBandMin("");
        setBandMid("");
        setBandMax("");
        setBandDeductionAmount("");
        setBandDeductionNote("");
        router.refresh();
      }
    });
  }

  function handleDeleteBand(id: string) {
    startTransition(async () => {
      const result = await deleteSalaryBand(id);
      if (!("error" in result)) {
        setBands((prev) => prev.filter((b) => b.id !== id));
        router.refresh();
      }
    });
  }

  // --- Terminology ---
  const [terminology, setTerminology] = useState<Map<string, string>>(new Map(initialTerminology));
  const [editingField, setEditingField] = useState<CompensationFieldKey | null>(null);
  const [labelDraft, setLabelDraft] = useState("");

  function startEditLabel(field: CompensationFieldKey) {
    setEditingField(field);
    setLabelDraft(compensationFieldLabel(t, terminology, field));
  }

  function handleSaveLabel(field: CompensationFieldKey) {
    startTransition(async () => {
      const result = await setCompensationTerminology(organizationId, field, labelDraft);
      if (!("error" in result)) {
        setTerminology((prev) => new Map(prev).set(field, labelDraft.trim()));
        setEditingField(null);
        router.refresh();
      }
    });
  }

  // --- Proposal queue ---
  const [proposals, setProposals] = useState(initialProposals);
  const [decisionComment, setDecisionComment] = useState<Record<string, string>>({});

  // A newly-submitted proposal (below) doesn't carry enough info client-side
  // to construct a full CompensationProposal (proposedBy, createdAt, etc.)
  // for an optimistic update — router.refresh() re-fetches the real thing
  // server-side, and this syncs it into local state once that lands. Synced
  // during render (React's documented pattern for "adjust state when a prop
  // changes"), not via useEffect — setState inside an effect body causes an
  // extra, avoidable render pass.
  const [prevInitialProposals, setPrevInitialProposals] = useState(initialProposals);
  if (initialProposals !== prevInitialProposals) {
    setPrevInitialProposals(initialProposals);
    setProposals(initialProposals);
  }

  function handleDecision(proposalId: string, decision: "approved" | "rejected") {
    startTransition(async () => {
      const result = await decideCompensationProposal(proposalId, decision, decisionComment[proposalId]?.trim() || null);
      if (!("error" in result)) {
        setProposals((prev) => prev.map((p) => (p.id === proposalId ? { ...p, status: decision } : p)));
        router.refresh();
      }
    });
  }

  const pendingProposals = proposals.filter((p) => p.status === "pending");
  const decidedProposals = proposals.filter((p) => p.status !== "pending");

  // --- Propose a change (org-wide — a Comp Admin can propose for ANY
  // employee, not just their own direct reports; propose_compensation_
  // change's RPC already authorizes this via has_compensation_access, but
  // until now there was no UI entry point for it here, only on My Team for
  // a manager's own reports. That left no way to set a brand-new
  // employee's first compensation record if their manager hadn't done it. ---
  const [proposeFor, setProposeFor] = useState("");
  const [proposeAmount, setProposeAmount] = useState("");
  const [proposeCurrency, setProposeCurrency] = useState("USD");
  const [proposeBandId, setProposeBandId] = useState("");
  const [proposeEffectiveDate, setProposeEffectiveDate] = useState("");
  const [proposeReason, setProposeReason] = useState("");
  const [proposeDeductionAmount, setProposeDeductionAmount] = useState("");
  const [proposeDeductionNote, setProposeDeductionNote] = useState("");
  const [proposeError, setProposeError] = useState<string | null>(null);
  const [proposeSuccess, setProposeSuccess] = useState<string | null>(null);

  // Picking a band fills in its default deduction reference as a starting
  // point — still freely editable, never silently applied without the
  // admin seeing it (the whole field is reference-only anyway, see 0165).
  function handleProposeBandChange(bandId: string) {
    setProposeBandId(bandId);
    const band = bands.find((b) => b.id === bandId);
    if (band) {
      if (proposeDeductionAmount.trim() === "" && band.defaultMonthlyDeductionAmount !== null) {
        setProposeDeductionAmount(String(band.defaultMonthlyDeductionAmount));
      }
      if (proposeDeductionNote.trim() === "" && band.defaultDeductionNote) {
        setProposeDeductionNote(band.defaultDeductionNote);
      }
    }
  }

  function handlePropose(e: React.FormEvent) {
    e.preventDefault();
    setProposeError(null);
    setProposeSuccess(null);
    if (!proposeFor) return setProposeError(t("pickEmployeeError"));
    const amount = Number(proposeAmount);
    if (!Number.isFinite(amount) || amount < 0) return setProposeError(t("invalidAmount"));
    if (!proposeEffectiveDate) return setProposeError(t("pickDateError"));
    const deductionAmount = proposeDeductionAmount.trim() === "" ? null : Number(proposeDeductionAmount);

    startTransition(async () => {
      const result = await proposeCompensationChange({
        organizationId,
        employeeUserId: proposeFor,
        proposedAmount: amount,
        proposedCurrency: proposeCurrency,
        proposedSalaryBandId: proposeBandId || null,
        proposedEffectiveDate: proposeEffectiveDate,
        reason: proposeReason.trim() || null,
        proposedMonthlyDeductionAmount: deductionAmount,
        proposedDeductionNote: proposeDeductionNote.trim() || null,
      });
      if ("error" in result) {
        setProposeError(result.error);
      } else {
        setProposeSuccess(t("proposalSubmitted"));
        setProposeFor("");
        setProposeAmount("");
        setProposeBandId("");
        setProposeEffectiveDate("");
        setProposeReason("");
        setProposeDeductionAmount("");
        setProposeDeductionNote("");
        router.refresh();
      }
    });
  }

  const tabButtonStyle = (tab: string): React.CSSProperties => ({
    padding: "10px 18px",
    fontSize: 13,
    fontWeight: 700,
    background: "none",
    border: "none",
    borderBottom: activeTab === tab ? "2px solid var(--teal)" : "2px solid transparent",
    color: activeTab === tab ? "var(--teal)" : "var(--text-muted)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
  });
  const countPillStyle: React.CSSProperties = {
    background: "var(--teal)",
    color: "#0A0F1E",
    borderRadius: 999,
    padding: "1px 7px",
    fontSize: 11,
    fontWeight: 800,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)" }}>
        <button type="button" onClick={() => setActiveTab("requests")} style={tabButtonStyle("requests")}>
          {t("tabRequests")}
          {pendingProposals.length > 0 && <span style={countPillStyle}>{pendingProposals.length}</span>}
        </button>
        <button type="button" onClick={() => setActiveTab("roster")} style={tabButtonStyle("roster")}>
          {t("tabRoster")}
        </button>
        <button type="button" onClick={() => setActiveTab("settings")} style={tabButtonStyle("settings")}>
          {t("tabSettings")}
        </button>
      </div>

      {activeTab === "requests" && (
      <>
      {/* Proposal queue */}
      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>{t("proposalQueueTitle", { count: pendingProposals.length })}</h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>{t("proposalQueueDescription")}</p>
        {pendingProposals.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("noPendingProposals")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pendingProposals.map((p) => (
              <div key={p.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>
                    {employeeNames[p.employeeUserId]?.name ?? t("unknownEmployee")}
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--teal)" }}>
                    {formatAmount(p.proposedAmount, p.proposedCurrency)}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                  {t("proposedBy", { name: employeeNames[p.proposedBy]?.name ?? t("unknownEmployee"), date: new Date(p.createdAt).toLocaleDateString() })}
                </p>
                {p.reason && <p style={{ fontSize: 12.5, color: "var(--text)", marginBottom: 10, lineHeight: 1.5 }}>{p.reason}</p>}
                <input
                  placeholder={t("commentPlaceholder")}
                  value={decisionComment[p.id] ?? ""}
                  onChange={(e) => setDecisionComment((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  style={{ ...fieldStyle, marginBottom: 10 }}
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" disabled={isPending} onClick={() => handleDecision(p.id, "approved")} style={{ ...btnPrimary, padding: "8px 16px" }}>
                    {t("approveButton")}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDecision(p.id, "rejected")}
                    style={{ ...btnPrimary, background: "transparent", color: "var(--danger)", border: "1px solid var(--danger)", padding: "8px 16px" }}
                  >
                    {t("rejectButton")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {decidedProposals.length > 0 && (
          <details style={{ marginTop: 16 }}>
            <summary style={{ fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}>{t("recentDecisionsTitle", { count: decidedProposals.length })}</summary>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
              {decidedProposals.slice(0, 10).map((p) => (
                <div key={p.id} style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                  <span>{employeeNames[p.employeeUserId]?.name ?? t("unknownEmployee")} — {formatAmount(p.proposedAmount, p.proposedCurrency)}</span>
                  <span style={{ color: p.status === "approved" ? "var(--teal)" : "var(--danger)" }}>{t(`status_${p.status}`)}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Propose a change — collapsed behind a button so it doesn't take
          up permanent space when the admin is just here to decide the
          queue above. */}
      <div style={cardStyle}>
        {!showProposeForm ? (
          <button type="button" onClick={() => setShowProposeForm(true)} style={btnPrimary}>
            + {t("adminProposeTitle")}
          </button>
        ) : (
        <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <h2 style={{ ...sectionTitleStyle, marginBottom: 0 }}>{t("adminProposeTitle")}</h2>
          <button type="button" onClick={() => setShowProposeForm(false)} style={btnGhost}>
            {t("closeButton")}
          </button>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>{t("adminProposeDescription")}</p>
        <form onSubmit={handlePropose}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>{t("employeeLabel")}</label>
              <select value={proposeFor} onChange={(e) => setProposeFor(e.target.value)} style={fieldStyle}>
                <option value="">{t("selectEmployeePlaceholder")}</option>
                {employees.map((emp) => (
                  <option key={emp.userId} value={emp.userId}>
                    {emp.name} ({emp.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{t("newAmountLabel")}</label>
              <input value={proposeAmount} onChange={(e) => setProposeAmount(e.target.value)} type="number" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{t("currencyLabel")}</label>
              <input value={proposeCurrency} onChange={(e) => setProposeCurrency(e.target.value.toUpperCase())} maxLength={3} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{t("effectiveDateLabel")}</label>
              <input value={proposeEffectiveDate} onChange={(e) => setProposeEffectiveDate(e.target.value)} type="date" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{t("bandLabel")}</label>
              <select value={proposeBandId} onChange={(e) => handleProposeBandChange(e.target.value)} style={fieldStyle}>
                <option value="">{t("noBandOption")}</option>
                {bands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{t("deductionAmountLabel")}</label>
              <input value={proposeDeductionAmount} onChange={(e) => setProposeDeductionAmount(e.target.value)} type="number" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{t("deductionNoteLabel")}</label>
              <input value={proposeDeductionNote} onChange={(e) => setProposeDeductionNote(e.target.value)} placeholder={t("deductionNotePlaceholder")} style={fieldStyle} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>{t("reasonLabel")}</label>
            <textarea value={proposeReason} onChange={(e) => setProposeReason(e.target.value)} rows={2} style={{ ...fieldStyle, resize: "vertical" }} />
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12, fontStyle: "italic" }}>{t("deductionDisclaimer")}</p>
          <button type="submit" disabled={isPending} style={{ ...btnPrimary, opacity: isPending ? 0.6 : 1 }}>
            {isPending ? t("proposing") : t("proposeButton")}
          </button>
          {proposeError && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{proposeError}</p>}
          {proposeSuccess && <p style={{ color: "var(--teal)", fontSize: 13, marginTop: 10 }}>{proposeSuccess}</p>}
        </form>
        </>
        )}
      </div>
      </>
      )}

      {activeTab === "roster" && (
      <>
      {/* Roster */}
      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>{t("rosterTitle", { count: initialRoster.length })}</h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>{t("rosterDescription")}</p>
        {initialRoster.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("noRosterRecords")}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "8px 6px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11 }}>{t("colEmployee")}</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11 }}>{t("colAmount")}</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11 }}>{t("colFrequency")}</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11 }}>{t("colEffectiveFrom")}</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11 }}>{t("colDeduction")}</th>
                </tr>
              </thead>
              <tbody>
                {initialRoster.map((r) => (
                  <tr key={r.employeeUserId} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 6px", color: "var(--text)" }}>{employeeNames[r.employeeUserId]?.name ?? t("unknownEmployee")}</td>
                    <td style={{ padding: "8px 6px", color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{formatAmount(r.amount, r.currency)}</td>
                    <td style={{ padding: "8px 6px", color: "var(--text-muted)" }}>{t(`frequency_${r.payFrequency}`)}</td>
                    <td style={{ padding: "8px 6px", color: "var(--text-muted)" }}>{new Date(r.effectiveFrom).toLocaleDateString()}</td>
                    <td style={{ padding: "8px 6px", color: "var(--text-muted)" }}>
                      {r.monthlyDeductionAmount !== null ? formatAmount(r.monthlyDeductionAmount, r.currency) : "—"}
                      {r.deductionNote ? ` (${r.deductionNote})` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {activeTab === "settings" && (
      <>
      {/* Manager visibility setting */}
      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>{t("managerVisibilityTitle")}</h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6, maxWidth: 560 }}>{t("managerVisibilityDescription")}</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {(["none", "band", "exact"] as const).map((option) => (
            <button
              key={option}
              type="button"
              disabled={isPending}
              onClick={() => handleVisibilityChange(option)}
              style={{
                ...btnPrimary,
                background: managerVisibility === option ? "var(--teal)" : "transparent",
                color: managerVisibility === option ? "#0A0F1E" : "var(--text)",
                border: "1px solid var(--border)",
                padding: "8px 16px",
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {t(`managerVisibility_${option}`)}
            </button>
          ))}
        </div>
        {visibilitySaved && <p style={{ color: "var(--teal)", fontSize: 12, marginTop: 10 }}>{t("managerVisibilitySaved")}</p>}
      </div>

      {/* Salary bands */}
      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>{t("bandsTitle")}</h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>{t("bandsDescription")}</p>
        <form onSubmit={handleCreateBand} style={{ marginBottom: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>{t("bandKeyLabel")}</label>
              <input value={bandKey} onChange={(e) => setBandKey(e.target.value)} placeholder="L4_ENG" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{t("bandNameLabel")}</label>
              <input value={bandName} onChange={(e) => setBandName(e.target.value)} placeholder={t("bandNamePlaceholder")} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{t("currencyLabel")}</label>
              <input value={bandCurrency} onChange={(e) => setBandCurrency(e.target.value.toUpperCase())} maxLength={3} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{t("minLabel")}</label>
              <input value={bandMin} onChange={(e) => setBandMin(e.target.value)} type="number" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{t("midLabel")}</label>
              <input value={bandMid} onChange={(e) => setBandMid(e.target.value)} type="number" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{t("maxLabel")}</label>
              <input value={bandMax} onChange={(e) => setBandMax(e.target.value)} type="number" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{t("deductionAmountLabel")}</label>
              <input value={bandDeductionAmount} onChange={(e) => setBandDeductionAmount(e.target.value)} type="number" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{t("deductionNoteLabel")}</label>
              <input value={bandDeductionNote} onChange={(e) => setBandDeductionNote(e.target.value)} placeholder={t("deductionNotePlaceholder")} style={fieldStyle} />
            </div>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12, fontStyle: "italic" }}>{t("deductionDisclaimer")}</p>
          <button type="submit" disabled={isPending} style={{ ...btnPrimary, opacity: isPending ? 0.6 : 1 }}>
            {isPending ? t("adding") : t("addBandButton")}
          </button>
          {bandError && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{bandError}</p>}
        </form>
        {bands.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("noBands")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {bands.map((b) => (
              <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, fontSize: 13, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ color: "var(--text)" }}>
                  <strong>{b.displayName}</strong>{" "}
                  <span style={{ color: "var(--text-muted)" }}>
                    ({b.bandKey}) — {formatAmount(b.minAmount, b.currency)}
                    {b.midAmount !== null && ` / ${formatAmount(b.midAmount, b.currency)}`} / {formatAmount(b.maxAmount, b.currency)}
                    {b.defaultMonthlyDeductionAmount !== null &&
                      ` · ${t("colDeduction")}: ${formatAmount(b.defaultMonthlyDeductionAmount, b.currency)}`}
                  </span>
                </span>
                <button type="button" disabled={isPending} onClick={() => handleDeleteBand(b.id)} style={btnGhost}>
                  {t("removeButton")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Terminology */}
      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>{t("terminologyTitle")}</h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>{t("terminologyDescription")}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {COMPENSATION_FIELD_KEYS.map((field) => (
            <div key={field} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, fontSize: 13, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-muted)", fontSize: 11.5 }}>{t(`field_${field}`)}</span>
              {editingField === field ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1, justifyContent: "flex-end" }}>
                  <input value={labelDraft} onChange={(e) => setLabelDraft(e.target.value)} style={{ ...fieldStyle, width: 180 }} />
                  <button type="button" disabled={isPending} onClick={() => handleSaveLabel(field)} style={btnGhost}>
                    {t("saveButton")}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => startEditLabel(field)} style={{ ...btnGhost, color: "var(--text)", fontWeight: 600 }}>
                  {compensationFieldLabel(t, terminology, field)}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      </>
      )}
    </div>
  );
}
