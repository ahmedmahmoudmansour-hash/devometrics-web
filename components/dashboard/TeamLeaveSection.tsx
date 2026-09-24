"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { decideLeaveRequest, getLeaveAttachmentUrl, type LeaveRequest, type LeaveType } from "@/lib/leave/actions";

// Direct reports only — list_team_compensation-style RPC filtering isn't
// used here (leave uses plain RLS, not RPCs), so the caller (my-team
// page) pre-filters to pulseMembers' ids before this ever renders, rather
// than trusting RLS's broader (self OR admin OR manager-of) result set to
// already be team-scoped — an org-admin-who's-also-a-manager would
// otherwise see the whole org's requests labeled "my team."
export default function TeamLeaveSection({
  initialRequests,
  leaveTypes,
  employeeNames,
}: {
  initialRequests: LeaveRequest[];
  leaveTypes: LeaveType[];
  employeeNames: Record<string, { name: string; email: string }>;
}) {
  const t = useTranslations("teamLeaveSection");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [requests, setRequests] = useState(initialRequests);
  const [decisionComment, setDecisionComment] = useState<Record<string, string>>({});
  const [openingAttachment, setOpeningAttachment] = useState<string | null>(null);

  const pending = requests.filter((r) => r.status === "pending");
  if (initialRequests.length === 0) return null;

  function handleDecision(requestId: string, decision: "approved" | "rejected") {
    startTransition(async () => {
      const result = await decideLeaveRequest(requestId, decision, decisionComment[requestId]?.trim() || null);
      if (!("error" in result)) {
        setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status: decision } : r)));
        router.refresh();
      }
    });
  }

  function handleViewAttachment(requestId: string) {
    setOpeningAttachment(requestId);
    startTransition(async () => {
      const result = await getLeaveAttachmentUrl(requestId);
      setOpeningAttachment(null);
      if ("url" in result) window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  const typeName = (id: string) => leaveTypes.find((lt) => lt.id === id)?.name ?? t("unknownType");

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("title", { count: pending.length })}</h2>
      {pending.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("noPendingRequests")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {pending.map((r) => (
            <div key={r.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{employeeNames[r.employeeUserId]?.name ?? t("unknownEmployee")}</span>
                <span style={{ fontSize: 13, color: "var(--teal)" }}>
                  {typeName(r.leaveTypeId)} · {r.daysRequested} {t("days")}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                {new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}
              </p>
              {r.reason && <p style={{ fontSize: 12.5, color: "var(--text)", marginBottom: 10 }}>{r.reason}</p>}
              {r.attachmentFileName && (
                <button
                  type="button"
                  disabled={openingAttachment === r.id}
                  onClick={() => handleViewAttachment(r.id)}
                  style={{ background: "none", border: "none", color: "var(--teal)", fontSize: 12, cursor: "pointer", textDecoration: "underline", display: "block", marginBottom: 10 }}
                >
                  {openingAttachment === r.id ? t("opening") : t("viewAttachment")}
                </button>
              )}
              <input
                placeholder={t("commentPlaceholder")}
                value={decisionComment[r.id] ?? ""}
                onChange={(e) => setDecisionComment((prev) => ({ ...prev, [r.id]: e.target.value }))}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13,
                  color: "var(--text)",
                  outline: "none",
                  width: "100%",
                  marginBottom: 10,
                }}
              />
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDecision(r.id, "approved")}
                  style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  {t("approveButton")}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDecision(r.id, "rejected")}
                  style={{ background: "transparent", color: "var(--danger)", border: "1px solid var(--danger)", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  {t("rejectButton")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
