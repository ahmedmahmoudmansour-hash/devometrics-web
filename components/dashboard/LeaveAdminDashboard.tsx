"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createLeaveType,
  deleteLeaveType,
  setLeaveBalanceAllocation,
  recordLeaveDirectly,
  decideLeaveRequest,
  overrideLeaveDecision,
  setLeaveManagerVisibility,
  setLeaveTypeEligibility,
  getLeaveAttachmentUrl,
  type LeaveType,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveManagerVisibility,
} from "@/lib/leave/actions";
import { decideHrLetterRequest, type HrLetterRequest } from "@/lib/hrLetters/actions";

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

export default function LeaveAdminDashboard({
  organizationId,
  currentYear,
  initialLeaveTypes,
  initialBalances,
  initialRequests,
  initialHrLetterRequests,
  initialManagerVisibility,
  leaveTypeEligibility,
  employeeNames,
  employees,
}: {
  organizationId: string;
  currentYear: number;
  initialLeaveTypes: LeaveType[];
  initialBalances: LeaveBalance[];
  initialRequests: LeaveRequest[];
  initialHrLetterRequests: HrLetterRequest[];
  initialManagerVisibility: LeaveManagerVisibility;
  leaveTypeEligibility: Record<string, string[]>;
  employeeNames: Record<string, { name: string; email: string }>;
  employees: { userId: string; name: string; email: string }[];
}) {
  const t = useTranslations("companyLeavePage");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Tabs instead of five permanently-stacked cards — same simplification
  // as CompensationAdminDashboard: an admin here is almost always doing
  // ONE of "decide something pending", "check balances", or "configure
  // leave types", not all three at once.
  const [activeTab, setActiveTab] = useState<"requests" | "balances" | "hrLetters" | "settings">("requests");
  const [showRecordForm, setShowRecordForm] = useState(false);

  // --- HR letter requests ---
  const [hrLetterRequests, setHrLetterRequests] = useState(initialHrLetterRequests);
  const pendingLetters = hrLetterRequests.filter((r) => r.status === "pending");
  const decidedLetters = hrLetterRequests.filter((r) => r.status !== "pending");
  const [letterNote, setLetterNote] = useState<Record<string, string>>({});
  const [letterError, setLetterError] = useState<string | null>(null);

  function handleLetterDecision(requestId: string, decision: "issued" | "rejected") {
    setLetterError(null);
    startTransition(async () => {
      const result = await decideHrLetterRequest(requestId, decision, letterNote[requestId]?.trim() || null);
      if ("error" in result) {
        setLetterError(result.error);
      } else {
        setHrLetterRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: decision, decidedAt: new Date().toISOString(), decisionNote: letterNote[requestId]?.trim() || null } : r))
        );
        router.refresh();
      }
    });
  }

  // --- Leave manager visibility (0169) ---
  const [managerVisibility, setManagerVisibility] = useState(initialManagerVisibility);

  function handleVisibilityChange(visibility: LeaveManagerVisibility) {
    setManagerVisibility(visibility);
    startTransition(async () => {
      await setLeaveManagerVisibility(organizationId, visibility);
      router.refresh();
    });
  }

  // --- Leave types ---
  const [leaveTypes, setLeaveTypes] = useState(initialLeaveTypes);
  const [typeName, setTypeName] = useState("");
  const [typeColor, setTypeColor] = useState("#2dd4bf");
  const [typeIsPaid, setTypeIsPaid] = useState(true);
  const [typeRequiresApproval, setTypeRequiresApproval] = useState(true);
  const [typeDefaultDays, setTypeDefaultDays] = useState("");
  const [typeEligibility, setTypeEligibility] = useState<"everyone" | "restricted">("everyone");
  const [typeEligibleIds, setTypeEligibleIds] = useState<string[]>([]);
  const [typeError, setTypeError] = useState<string | null>(null);

  function handleCreateType(e: React.FormEvent) {
    e.preventDefault();
    setTypeError(null);
    const defaultAnnualDays = Number(typeDefaultDays || 0);
    if (!Number.isFinite(defaultAnnualDays) || defaultAnnualDays < 0) return setTypeError(t("invalidDays"));

    startTransition(async () => {
      const result = await createLeaveType(organizationId, {
        name: typeName,
        color: typeColor,
        isPaid: typeIsPaid,
        requiresApproval: typeRequiresApproval,
        defaultAnnualDays,
        eligibility: typeEligibility,
        eligibleEmployeeIds: typeEligibility === "restricted" ? typeEligibleIds : undefined,
      });
      if ("error" in result) {
        setTypeError(result.error);
      } else {
        setLeaveTypes((prev) => [
          ...prev,
          { id: result.id, name: typeName, color: typeColor, isPaid: typeIsPaid, requiresApproval: typeRequiresApproval, defaultAnnualDays, eligibility: typeEligibility },
        ]);
        if (typeEligibility === "restricted" && typeEligibleIds.length) {
          setEligibilityByType((prev) => ({ ...prev, [result.id]: typeEligibleIds }));
        }
        setTypeName("");
        setTypeDefaultDays("");
        setTypeEligibility("everyone");
        setTypeEligibleIds([]);
        router.refresh();
      }
    });
  }

  function handleDeleteType(id: string) {
    startTransition(async () => {
      const result = await deleteLeaveType(id);
      if (!("error" in result)) {
        setLeaveTypes((prev) => prev.filter((lt) => lt.id !== id));
        router.refresh();
      }
    });
  }

  // --- Leave type eligibility (0174) — who a 'restricted' type is even
  // offered to. Kept separate from the create-form state above: this edits
  // an EXISTING type (Ahmed's actual case — Maternity/Paternity were
  // already created as 'everyone' and need narrowing after the fact), not
  // just the one being created.
  const [eligibilityByType, setEligibilityByType] = useState<Record<string, string[]>>(leaveTypeEligibility);
  const [editingEligibilityId, setEditingEligibilityId] = useState<string | null>(null);
  const [eligibilityDraftMode, setEligibilityDraftMode] = useState<"everyone" | "restricted">("everyone");
  const [eligibilityDraftIds, setEligibilityDraftIds] = useState<string[]>([]);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);

  function startEditEligibility(lt: LeaveType) {
    setEditingEligibilityId(lt.id);
    setEligibilityDraftMode(lt.eligibility);
    setEligibilityDraftIds(eligibilityByType[lt.id] ?? []);
    setEligibilityError(null);
  }

  function toggleDraftEmployee(ids: string[], setIds: (ids: string[]) => void, userId: string) {
    setIds(ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]);
  }

  function handleSaveEligibility(leaveTypeId: string) {
    setEligibilityError(null);
    startTransition(async () => {
      const result = await setLeaveTypeEligibility(organizationId, leaveTypeId, eligibilityDraftMode, eligibilityDraftMode === "restricted" ? eligibilityDraftIds : []);
      if ("error" in result) {
        setEligibilityError(result.error);
      } else {
        setLeaveTypes((prev) => prev.map((lt) => (lt.id === leaveTypeId ? { ...lt, eligibility: eligibilityDraftMode } : lt)));
        setEligibilityByType((prev) => ({ ...prev, [leaveTypeId]: eligibilityDraftMode === "restricted" ? eligibilityDraftIds : [] }));
        setEditingEligibilityId(null);
        router.refresh();
      }
    });
  }

  // --- Balances ---
  const [balances, setBalances] = useState(initialBalances);
  const [editingBalanceKey, setEditingBalanceKey] = useState<string | null>(null);
  const [balanceDraft, setBalanceDraft] = useState("");

  function balanceKey(employeeUserId: string, leaveTypeId: string) {
    return `${employeeUserId}:${leaveTypeId}`;
  }

  function findBalance(employeeUserId: string, leaveTypeId: string): LeaveBalance | undefined {
    return balances.find((b) => b.employeeUserId === employeeUserId && b.leaveTypeId === leaveTypeId);
  }

  function startEditBalance(employeeUserId: string, leaveTypeId: string) {
    const existing = findBalance(employeeUserId, leaveTypeId);
    const leaveType = leaveTypes.find((lt) => lt.id === leaveTypeId);
    setEditingBalanceKey(balanceKey(employeeUserId, leaveTypeId));
    setBalanceDraft(String(existing?.allocatedDays ?? leaveType?.defaultAnnualDays ?? 0));
  }

  function handleSaveBalance(employeeUserId: string, leaveTypeId: string) {
    const allocatedDays = Number(balanceDraft);
    if (!Number.isFinite(allocatedDays) || allocatedDays < 0) return;

    startTransition(async () => {
      const result = await setLeaveBalanceAllocation(organizationId, employeeUserId, leaveTypeId, currentYear, allocatedDays);
      if (!("error" in result)) {
        setBalances((prev) => {
          const existing = findBalance(employeeUserId, leaveTypeId);
          if (existing) {
            return prev.map((b) => (b.id === existing.id ? { ...b, allocatedDays } : b));
          }
          return [
            ...prev,
            { id: `${employeeUserId}-${leaveTypeId}-pending`, employeeUserId, leaveTypeId, year: currentYear, allocatedDays, usedDays: 0 },
          ];
        });
        setEditingBalanceKey(null);
        router.refresh();
      }
    });
  }

  // --- Record leave directly ---
  const [recordFor, setRecordFor] = useState("");
  const [recordTypeId, setRecordTypeId] = useState("");
  const [recordStart, setRecordStart] = useState("");
  const [recordEnd, setRecordEnd] = useState("");
  const [recordDays, setRecordDays] = useState("");
  const [recordReason, setRecordReason] = useState("");
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordSuccess, setRecordSuccess] = useState<string | null>(null);

  function handleRecordDirectly(e: React.FormEvent) {
    e.preventDefault();
    setRecordError(null);
    setRecordSuccess(null);
    if (!recordFor) return setRecordError(t("pickEmployeeError"));
    if (!recordTypeId) return setRecordError(t("pickTypeError"));
    if (!recordStart || !recordEnd) return setRecordError(t("pickDatesError"));
    const days = Number(recordDays);
    if (!Number.isFinite(days) || days <= 0) return setRecordError(t("invalidDays"));

    startTransition(async () => {
      const result = await recordLeaveDirectly({
        organizationId,
        employeeUserId: recordFor,
        leaveTypeId: recordTypeId,
        startDate: recordStart,
        endDate: recordEnd,
        daysRequested: days,
        reason: recordReason.trim() || null,
      });
      if ("error" in result) {
        setRecordError(result.error);
      } else {
        setRecordSuccess(t("recordedSuccess"));
        setRecordFor("");
        setRecordTypeId("");
        setRecordStart("");
        setRecordEnd("");
        setRecordDays("");
        setRecordReason("");
        router.refresh();
      }
    });
  }

  // --- Pending requests ---
  const [requests, setRequests] = useState(initialRequests);
  const [decisionComment, setDecisionComment] = useState<Record<string, string>>({});
  const pendingRequests = requests.filter((r) => r.status === "pending");
  const decidedRequests = requests.filter((r) => r.status === "approved" || r.status === "rejected");

  const [openingAttachment, setOpeningAttachment] = useState<string | null>(null);
  function handleViewAttachment(requestId: string) {
    setOpeningAttachment(requestId);
    startTransition(async () => {
      const result = await getLeaveAttachmentUrl(requestId);
      setOpeningAttachment(null);
      if ("url" in result) window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  function handleDecision(requestId: string, decision: "approved" | "rejected") {
    startTransition(async () => {
      const result = await decideLeaveRequest(requestId, decision, decisionComment[requestId]?.trim() || null);
      if (!("error" in result)) {
        setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status: decision } : r)));
        router.refresh();
      }
    });
  }

  // --- HR override of an already-decided request ---
  const [overridingId, setOverridingId] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideError, setOverrideError] = useState<string | null>(null);

  function handleOverride(requestId: string, decision: "approved" | "rejected") {
    setOverrideError(null);
    startTransition(async () => {
      const result = await overrideLeaveDecision(requestId, decision, overrideReason.trim() || null);
      if ("error" in result) {
        setOverrideError(result.error);
      } else {
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: decision, overriddenAt: new Date().toISOString(), overrideReason: overrideReason.trim() || null } : r))
        );
        setOverridingId(null);
        setOverrideReason("");
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
          {pendingRequests.length > 0 && <span style={countPillStyle}>{pendingRequests.length}</span>}
        </button>
        <button type="button" onClick={() => setActiveTab("balances")} style={tabButtonStyle("balances")}>
          {t("tabBalances")}
        </button>
        <button type="button" onClick={() => setActiveTab("hrLetters")} style={tabButtonStyle("hrLetters")}>
          {t("tabHrLetters")}
          {pendingLetters.length > 0 && <span style={countPillStyle}>{pendingLetters.length}</span>}
        </button>
        <button type="button" onClick={() => setActiveTab("settings")} style={tabButtonStyle("settings")}>
          {t("tabSettings")}
        </button>
      </div>

      {activeTab === "requests" && (
        <>
          {/* Pending requests */}
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>{t("pendingRequestsTitle", { count: pendingRequests.length })}</h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>{t("pendingRequestsDescription")}</p>
            {pendingRequests.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("noPendingRequests")}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {pendingRequests.map((r) => (
                  <div key={r.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>
                        {employeeNames[r.employeeUserId]?.name ?? t("unknownEmployee")}
                      </span>
                      <span style={{ fontSize: 13, color: "var(--teal)" }}>
                        {leaveTypes.find((lt) => lt.id === r.leaveTypeId)?.name ?? t("unknownType")} · {r.daysRequested} {t("days")}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                      {new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}
                    </p>
                    {r.reason && <p style={{ fontSize: 12.5, color: "var(--text)", marginBottom: 10, lineHeight: 1.5 }}>{r.reason}</p>}
                    {r.attachmentFileName && (
                      <button
                        type="button"
                        disabled={openingAttachment === r.id}
                        onClick={() => handleViewAttachment(r.id)}
                        style={{ ...btnGhost, color: "var(--teal)", textDecoration: "underline", display: "block", marginBottom: 10 }}
                      >
                        {openingAttachment === r.id ? t("opening") : t("viewAttachment")}
                      </button>
                    )}
                    <input
                      placeholder={t("commentPlaceholder")}
                      value={decisionComment[r.id] ?? ""}
                      onChange={(e) => setDecisionComment((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      style={{ ...fieldStyle, marginBottom: 10 }}
                    />
                    <div style={{ display: "flex", gap: 10 }}>
                      <button type="button" disabled={isPending} onClick={() => handleDecision(r.id, "approved")} style={{ ...btnPrimary, padding: "8px 16px" }}>
                        {t("approveButton")}
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDecision(r.id, "rejected")}
                        style={{ ...btnPrimary, background: "transparent", color: "var(--danger)", border: "1px solid var(--danger)", padding: "8px 16px" }}
                      >
                        {t("rejectButton")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent decisions — HR can override any of these */}
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>{t("recentDecisionsTitle", { count: decidedRequests.length })}</h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>{t("recentDecisionsDescription")}</p>
            {decidedRequests.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("noDecidedRequests")}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {decidedRequests.map((r) => (
                  <div key={r.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "var(--text)" }}>
                        {employeeNames[r.employeeUserId]?.name ?? t("unknownEmployee")} — {leaveTypes.find((lt) => lt.id === r.leaveTypeId)?.name ?? t("unknownType")} ({r.daysRequested} {t("days")})
                      </span>
                      <span style={{ color: r.status === "approved" ? "var(--teal)" : "var(--danger)", fontSize: 12, fontWeight: 700 }}>
                        {t(`status_${r.status}`)}
                        {r.overriddenAt && ` (${t("overridden")})`}
                      </span>
                    </div>
                    {r.attachmentFileName && (
                      <button
                        type="button"
                        disabled={openingAttachment === r.id}
                        onClick={() => handleViewAttachment(r.id)}
                        style={{ ...btnGhost, color: "var(--teal)", textDecoration: "underline", display: "block", marginTop: 8 }}
                      >
                        {openingAttachment === r.id ? t("opening") : t("viewAttachment")}
                      </button>
                    )}
                    {overridingId === r.id ? (
                      <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                        <input
                          placeholder={t("overrideReasonPlaceholder")}
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          style={{ ...fieldStyle, marginBottom: 8 }}
                        />
                        <div style={{ display: "flex", gap: 8 }}>
                          {r.status !== "approved" && (
                            <button type="button" disabled={isPending} onClick={() => handleOverride(r.id, "approved")} style={{ ...btnPrimary, padding: "6px 14px", fontSize: 12 }}>
                              {t("overrideToApprovedButton")}
                            </button>
                          )}
                          {r.status !== "rejected" && (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleOverride(r.id, "rejected")}
                              style={{ ...btnPrimary, background: "transparent", color: "var(--danger)", border: "1px solid var(--danger)", padding: "6px 14px", fontSize: 12 }}
                            >
                              {t("overrideToRejectedButton")}
                            </button>
                          )}
                          <button type="button" onClick={() => setOverridingId(null)} style={btnGhost}>
                            {t("cancelOverrideButton")}
                          </button>
                        </div>
                        {overrideError && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{overrideError}</p>}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setOverridingId(r.id);
                          setOverrideReason("");
                          setOverrideError(null);
                        }}
                        style={{ ...btnGhost, marginTop: 8 }}
                      >
                        {t("overrideButton")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === "balances" && (
        <>
          {/* Balances */}
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>{t("balancesTitle", { year: currentYear })}</h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>{t("balancesDescription")}</p>
            {leaveTypes.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("noLeaveTypesYet")}</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th style={{ textAlign: "left", padding: "8px 6px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11 }}>{t("colEmployee")}</th>
                      {leaveTypes.map((lt) => (
                        <th key={lt.id} style={{ textAlign: "left", padding: "8px 6px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11 }}>
                          {lt.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.userId} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "8px 6px", color: "var(--text)" }}>{emp.name}</td>
                        {leaveTypes.map((lt) => {
                          const key = balanceKey(emp.userId, lt.id);
                          const bal = findBalance(emp.userId, lt.id);
                          return (
                            <td key={lt.id} style={{ padding: "8px 6px", color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                              {editingBalanceKey === key ? (
                                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                  <input
                                    value={balanceDraft}
                                    onChange={(e) => setBalanceDraft(e.target.value)}
                                    type="number"
                                    style={{ ...fieldStyle, width: 60, padding: "4px 6px" }}
                                  />
                                  <button type="button" disabled={isPending} onClick={() => handleSaveBalance(emp.userId, lt.id)} style={btnGhost}>
                                    {t("saveButton")}
                                  </button>
                                </div>
                              ) : (
                                <button type="button" onClick={() => startEditBalance(emp.userId, lt.id)} style={{ ...btnGhost, color: "var(--text)" }}>
                                  {bal ? `${bal.usedDays} / ${bal.allocatedDays}` : `0 / ${lt.defaultAnnualDays}`}
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Record leave directly — collapsed behind a button */}
          <div style={cardStyle}>
            {!showRecordForm ? (
              <button type="button" onClick={() => setShowRecordForm(true)} style={btnPrimary}>
                + {t("recordDirectlyTitle")}
              </button>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <h2 style={{ ...sectionTitleStyle, marginBottom: 0 }}>{t("recordDirectlyTitle")}</h2>
                  <button type="button" onClick={() => setShowRecordForm(false)} style={btnGhost}>
                    {t("closeButton")}
                  </button>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>{t("recordDirectlyDescription")}</p>
                <form onSubmit={handleRecordDirectly}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 12 }}>
                    <div>
                      <label style={labelStyle}>{t("employeeLabel")}</label>
                      <select value={recordFor} onChange={(e) => setRecordFor(e.target.value)} style={fieldStyle}>
                        <option value="">{t("selectEmployeePlaceholder")}</option>
                        {employees.map((emp) => (
                          <option key={emp.userId} value={emp.userId}>
                            {emp.name} ({emp.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>{t("leaveTypeLabel")}</label>
                      <select value={recordTypeId} onChange={(e) => setRecordTypeId(e.target.value)} style={fieldStyle}>
                        <option value="">{t("selectTypePlaceholder")}</option>
                        {leaveTypes.map((lt) => (
                          <option key={lt.id} value={lt.id}>
                            {lt.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>{t("startDateLabel")}</label>
                      <input value={recordStart} onChange={(e) => setRecordStart(e.target.value)} type="date" style={fieldStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>{t("endDateLabel")}</label>
                      <input value={recordEnd} onChange={(e) => setRecordEnd(e.target.value)} type="date" style={fieldStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>{t("daysLabel")}</label>
                      <input value={recordDays} onChange={(e) => setRecordDays(e.target.value)} type="number" style={fieldStyle} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>{t("reasonLabel")}</label>
                    <textarea value={recordReason} onChange={(e) => setRecordReason(e.target.value)} rows={2} style={{ ...fieldStyle, resize: "vertical" }} />
                  </div>
                  <button type="submit" disabled={isPending} style={{ ...btnPrimary, opacity: isPending ? 0.6 : 1 }}>
                    {isPending ? t("recording") : t("recordButton")}
                  </button>
                  {recordError && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{recordError}</p>}
                  {recordSuccess && <p style={{ color: "var(--teal)", fontSize: 13, marginTop: 10 }}>{recordSuccess}</p>}
                </form>
              </>
            )}
          </div>
        </>
      )}

      {activeTab === "hrLetters" && (
        <>
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>{t("pendingLettersTitle", { count: pendingLetters.length })}</h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>{t("pendingLettersDescription")}</p>
            {pendingLetters.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("noPendingLetters")}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {pendingLetters.map((r) => (
                  <div key={r.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>
                        {employeeNames[r.employeeUserId]?.name ?? t("unknownEmployee")}
                      </span>
                      <span style={{ fontSize: 13, color: "var(--teal)" }}>{r.includeSalary ? t("withSalary") : t("withoutSalary")}</span>
                    </div>
                    {r.purpose && <p style={{ fontSize: 12.5, color: "var(--text)", marginBottom: 10, lineHeight: 1.5 }}>{r.purpose}</p>}
                    <input
                      placeholder={t("letterNotePlaceholder")}
                      value={letterNote[r.id] ?? ""}
                      onChange={(e) => setLetterNote((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      style={{ ...fieldStyle, marginBottom: 10 }}
                    />
                    <div style={{ display: "flex", gap: 10 }}>
                      <button type="button" disabled={isPending} onClick={() => handleLetterDecision(r.id, "issued")} style={{ ...btnPrimary, padding: "8px 16px" }}>
                        {t("issueButton")}
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleLetterDecision(r.id, "rejected")}
                        style={{ ...btnPrimary, background: "transparent", color: "var(--danger)", border: "1px solid var(--danger)", padding: "8px 16px" }}
                      >
                        {t("rejectButton")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {letterError && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 12 }}>{letterError}</p>}
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>{t("decidedLettersTitle", { count: decidedLetters.length })}</h2>
            {decidedLetters.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("noDecidedLetters")}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {decidedLetters.map((r) => (
                  <div key={r.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "var(--text)" }}>
                        {employeeNames[r.employeeUserId]?.name ?? t("unknownEmployee")} — {r.includeSalary ? t("withSalary") : t("withoutSalary")}
                      </span>
                      <span style={{ color: r.status === "issued" ? "var(--teal)" : "var(--danger)", fontSize: 12, fontWeight: 700 }}>{t(`letterStatus_${r.status}`)}</span>
                    </div>
                    {r.purpose && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>{t("purposeLabel")}: {r.purpose}</p>}
                    {r.decisionNote && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{t("decisionNoteLabel")}: {r.decisionNote}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === "settings" && (
        <>
          {/* Manager visibility */}
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>{t("managerVisibilityTitle")}</h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>{t("managerVisibilityDescription")}</p>
            <select value={managerVisibility} onChange={(e) => handleVisibilityChange(e.target.value as LeaveManagerVisibility)} style={{ ...fieldStyle, maxWidth: 260 }}>
              <option value="visible">{t("managerVisibilityVisible")}</option>
              <option value="hidden">{t("managerVisibilityHidden")}</option>
            </select>
          </div>

          {/* Leave types */}
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>{t("typesTitle")}</h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>{t("typesDescription")}</p>
            <form onSubmit={handleCreateType} style={{ marginBottom: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>{t("typeNameLabel")}</label>
                  <input value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder={t("typeNamePlaceholder")} style={fieldStyle} />
                </div>
                <div>
                  <label style={labelStyle}>{t("typeColorLabel")}</label>
                  <input value={typeColor} onChange={(e) => setTypeColor(e.target.value)} type="color" style={{ ...fieldStyle, padding: 4, height: 40 }} />
                </div>
                <div>
                  <label style={labelStyle}>{t("typeDefaultDaysLabel")}</label>
                  <input value={typeDefaultDays} onChange={(e) => setTypeDefaultDays(e.target.value)} type="number" style={fieldStyle} />
                </div>
                <div>
                  <label style={labelStyle}>{t("typeIsPaidLabel")}</label>
                  <select value={typeIsPaid ? "yes" : "no"} onChange={(e) => setTypeIsPaid(e.target.value === "yes")} style={fieldStyle}>
                    <option value="yes">{t("yes")}</option>
                    <option value="no">{t("no")}</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>{t("typeRequiresApprovalLabel")}</label>
                  <select value={typeRequiresApproval ? "yes" : "no"} onChange={(e) => setTypeRequiresApproval(e.target.value === "yes")} style={fieldStyle}>
                    <option value="yes">{t("yes")}</option>
                    <option value="no">{t("no")}</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>{t("typeEligibilityLabel")}</label>
                  <select value={typeEligibility} onChange={(e) => setTypeEligibility(e.target.value as "everyone" | "restricted")} style={fieldStyle}>
                    <option value="everyone">{t("eligibilityEveryone")}</option>
                    <option value="restricted">{t("eligibilityRestricted")}</option>
                  </select>
                </div>
              </div>
              {typeEligibility === "restricted" && (
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>{t("eligibleEmployeesLabel")}</label>
                  <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: 8 }}>
                    {employees.map((emp) => (
                      <label key={emp.userId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", padding: "5px 4px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={typeEligibleIds.includes(emp.userId)}
                          onChange={() => toggleDraftEmployee(typeEligibleIds, setTypeEligibleIds, emp.userId)}
                        />
                        {emp.name} <span style={{ color: "var(--text-muted)" }}>({emp.email})</span>
                      </label>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{t("eligibilityHint")}</p>
                </div>
              )}
              <button type="submit" disabled={isPending} style={{ ...btnPrimary, opacity: isPending ? 0.6 : 1 }}>
                {isPending ? t("adding") : t("addTypeButton")}
              </button>
              {typeError && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{typeError}</p>}
            </form>
            {leaveTypes.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("noLeaveTypesYet")}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {leaveTypes.map((lt) => (
                  <div key={lt.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, fontSize: 13 }}>
                      <span style={{ color: "var(--text)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {lt.color && <span style={{ width: 10, height: 10, borderRadius: 999, background: lt.color, display: "inline-block" }} />}
                        <strong>{lt.name}</strong>{" "}
                        <span style={{ color: "var(--text-muted)" }}>
                          — {lt.defaultAnnualDays} {t("days")}/yr · {lt.isPaid ? t("paid") : t("unpaid")} · {lt.requiresApproval ? t("requiresApproval") : t("noApprovalNeeded")}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: lt.eligibility === "restricted" ? "rgba(240,184,64,0.15)" : "rgba(255,255,255,0.08)",
                            color: lt.eligibility === "restricted" ? "var(--gold, #f0b840)" : "var(--text-muted)",
                          }}
                        >
                          {lt.eligibility === "restricted"
                            ? t("eligibilityBadgeRestricted", { count: eligibilityByType[lt.id]?.length ?? 0 })
                            : t("eligibilityBadgeEveryone")}
                        </span>
                      </span>
                      <span style={{ display: "flex", gap: 14, flexShrink: 0 }}>
                        <button type="button" disabled={isPending} onClick={() => startEditEligibility(lt)} style={btnGhost}>
                          {t("editEligibilityButton")}
                        </button>
                        <button type="button" disabled={isPending} onClick={() => handleDeleteType(lt.id)} style={btnGhost}>
                          {t("removeButton")}
                        </button>
                      </span>
                    </div>
                    {editingEligibilityId === lt.id && (
                      <div style={{ marginTop: 10, padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                        <select value={eligibilityDraftMode} onChange={(e) => setEligibilityDraftMode(e.target.value as "everyone" | "restricted")} style={{ ...fieldStyle, maxWidth: 260, marginBottom: 10 }}>
                          <option value="everyone">{t("eligibilityEveryone")}</option>
                          <option value="restricted">{t("eligibilityRestricted")}</option>
                        </select>
                        {eligibilityDraftMode === "restricted" && (
                          <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: 8, marginBottom: 10 }}>
                            {employees.map((emp) => (
                              <label key={emp.userId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", padding: "5px 4px", cursor: "pointer" }}>
                                <input
                                  type="checkbox"
                                  checked={eligibilityDraftIds.includes(emp.userId)}
                                  onChange={() => toggleDraftEmployee(eligibilityDraftIds, setEligibilityDraftIds, emp.userId)}
                                />
                                {emp.name} <span style={{ color: "var(--text-muted)" }}>({emp.email})</span>
                              </label>
                            ))}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <button type="button" disabled={isPending} onClick={() => handleSaveEligibility(lt.id)} style={{ ...btnPrimary, padding: "8px 16px", fontSize: 13, opacity: isPending ? 0.6 : 1 }}>
                            {t("saveButton")}
                          </button>
                          <button type="button" onClick={() => setEditingEligibilityId(null)} style={btnGhost}>
                            {t("cancelButton")}
                          </button>
                        </div>
                        {eligibilityError && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{eligibilityError}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
