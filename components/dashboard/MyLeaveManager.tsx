"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import {
  requestLeave,
  cancelLeaveRequest,
  attachLeaveRequestFile,
  getLeaveAttachmentUrl,
  type LeaveType,
  type LeaveBalance,
  type LeaveRequest,
} from "@/lib/leave/actions";
import { LEAVE_ATTACHMENTS_BUCKET } from "@/lib/leave/constants";

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

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

export default function MyLeaveManager({
  organizationId,
  leaveTypes,
  balances,
  initialRequests,
}: {
  organizationId: string;
  leaveTypes: LeaveType[];
  balances: LeaveBalance[];
  initialRequests: LeaveRequest[];
}) {
  const t = useTranslations("myLeavePage");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [requests, setRequests] = useState(initialRequests);

  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [days, setDays] = useState("");
  const [reason, setReason] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Soft warnings — over-balance or an overlapping request don't block
  // submission (a manager/HR might have a legitimate reason to allow the
  // exception), but the employee has to see the warning and click submit
  // a second time rather than it going through silently.
  const [warning, setWarning] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!leaveTypeId) return setError(t("pickTypeError"));
    if (!startDate || !endDate) return setError(t("pickDatesError"));
    const daysRequested = Number(days);
    if (!Number.isFinite(daysRequested) || daysRequested <= 0) return setError(t("invalidDays"));

    if (!warning) {
      const bal = balances.find((b) => b.leaveTypeId === leaveTypeId);
      const leaveType = leaveTypes.find((lt) => lt.id === leaveTypeId);
      const allocated = bal?.allocatedDays ?? leaveType?.defaultAnnualDays ?? 0;
      const remaining = allocated - (bal?.usedDays ?? 0);
      const overOverlap = requests.some(
        (r) => (r.status === "pending" || r.status === "approved") && startDate <= r.endDate && r.startDate <= endDate
      );
      const overBalance = daysRequested > remaining;
      if (overBalance && overOverlap) {
        setWarning(t("warningBothOverBalanceAndOverlap", { remaining: Math.max(0, remaining) }));
        return;
      }
      if (overBalance) {
        setWarning(t("warningOverBalance", { remaining: Math.max(0, remaining) }));
        return;
      }
      if (overOverlap) {
        setWarning(t("warningOverlap"));
        return;
      }
    }

    startTransition(async () => {
      const result = await requestLeave({ organizationId, leaveTypeId, startDate, endDate, daysRequested, reason: reason.trim() || null });
      if ("error" in result) {
        setError(result.error);
        return;
      }

      // Upload after the request row exists (mirrors the candidate-CV
      // pattern: create the record, then attach the file to its id) — a
      // failed upload never loses the leave request itself, it just
      // surfaces separately so the employee knows to retry the attachment.
      let attachmentFileName: string | null = null;
      if (attachmentFile) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const storagePath = `${organizationId}/${user.id}/${crypto.randomUUID()}-${sanitizeFileName(attachmentFile.name)}`;
          const { error: uploadError } = await supabase.storage.from(LEAVE_ATTACHMENTS_BUCKET).upload(storagePath, attachmentFile);
          if (uploadError) {
            setError(t("attachmentUploadFailed"));
          } else {
            await attachLeaveRequestFile(result.id, { storagePath, fileName: attachmentFile.name });
            attachmentFileName = attachmentFile.name;
          }
        }
      }

      setSuccess(t("requestSubmitted"));
      setRequests((prev) => [
        {
          id: result.id,
          employeeUserId: "",
          leaveTypeId,
          startDate,
          endDate,
          daysRequested,
          status: "pending",
          reason: reason.trim() || null,
          requestedAt: new Date().toISOString(),
          decidedAt: null,
          decidedBy: null,
          decisionComment: null,
          overriddenAt: null,
          overriddenBy: null,
          overrideReason: null,
          attachmentFileName,
        },
        ...prev,
      ]);
      setStartDate("");
      setEndDate("");
      setDays("");
      setReason("");
      setAttachmentFile(null);
      setWarning(null);
      router.refresh();
    });
  }

  const [openingAttachment, setOpeningAttachment] = useState<string | null>(null);
  function handleViewAttachment(requestId: string) {
    setOpeningAttachment(requestId);
    startTransition(async () => {
      const result = await getLeaveAttachmentUrl(requestId);
      setOpeningAttachment(null);
      if ("url" in result) window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  // Any change to what's being requested invalidates a warning shown for
  // the previous inputs — re-check from scratch on the next submit rather
  // than letting a stale "submit anyway" apply to a different request.
  function clearWarning() {
    if (warning) setWarning(null);
  }

  function handleCancel(id: string) {
    startTransition(async () => {
      const result = await cancelLeaveRequest(id);
      if (!("error" in result)) {
        setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "cancelled" } : r)));
        router.refresh();
      }
    });
  }

  const typeName = (id: string) => leaveTypes.find((lt) => lt.id === id)?.name ?? t("unknownType");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("balancesTitle")}</h2>
        {balances.length === 0 && leaveTypes.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("noLeaveTypesYet")}</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 12 }}>
            {leaveTypes.map((lt) => {
              const bal = balances.find((b) => b.leaveTypeId === lt.id);
              const allocated = bal?.allocatedDays ?? lt.defaultAnnualDays;
              const used = bal?.usedDays ?? 0;
              return (
                <div key={lt.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, minWidth: 140 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    {lt.color && <span style={{ width: 8, height: 8, borderRadius: 999, background: lt.color, display: "inline-block", flexShrink: 0 }} />}
                    {lt.name}
                  </p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: "var(--teal)" }}>{Math.max(0, allocated - used)}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("remainingOfAllocated", { allocated })}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("requestTitle")}</h2>
        <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>{t("leaveTypeLabel")}</label>
              <select
                value={leaveTypeId}
                onChange={(e) => {
                  setLeaveTypeId(e.target.value);
                  clearWarning();
                }}
                style={fieldStyle}
              >
                {leaveTypes.map((lt) => (
                  <option key={lt.id} value={lt.id}>
                    {lt.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{t("startDateLabel")}</label>
              <input
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  clearWarning();
                }}
                type="date"
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>{t("endDateLabel")}</label>
              <input
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  clearWarning();
                }}
                type="date"
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>{t("daysLabel")}</label>
              <input
                value={days}
                onChange={(e) => {
                  setDays(e.target.value);
                  clearWarning();
                }}
                type="number"
                style={fieldStyle}
              />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>{t("reasonLabel")}</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} style={{ ...fieldStyle, resize: "vertical" }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>{t("attachmentLabel")}</label>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
              style={{ fontSize: 13, color: "var(--text-muted)" }}
            />
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{t("attachmentHint")}</p>
          </div>
          {warning && <p style={{ color: "var(--amber, #f0b840)", fontSize: 13, marginBottom: 10, lineHeight: 1.5 }}>{warning}</p>}
          <button type="submit" disabled={isPending || leaveTypes.length === 0} style={{ ...btnPrimary, opacity: isPending ? 0.6 : 1 }}>
            {isPending ? t("submitting") : warning ? t("submitAnywayButton") : t("submitButton")}
          </button>
          {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{error}</p>}
          {success && <p style={{ color: "var(--teal)", fontSize: 13, marginTop: 10 }}>{success}</p>}
        </form>
      </div>

      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("historyTitle")}</h2>
        {requests.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("noRequestsYet")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {requests.map((r) => {
              const lt = leaveTypes.find((type) => type.id === r.leaveTypeId);
              return (
                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, fontSize: 13, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
                    {lt?.color && <span style={{ width: 8, height: 8, borderRadius: 999, background: lt.color, display: "inline-block", flexShrink: 0 }} />}
                    {typeName(r.leaveTypeId)} — {new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()} ({r.daysRequested} {t("days")})
                    {r.attachmentFileName && (
                      <button
                        type="button"
                        disabled={openingAttachment === r.id}
                        onClick={() => handleViewAttachment(r.id)}
                        style={{ background: "none", border: "none", color: "var(--teal)", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
                      >
                        {openingAttachment === r.id ? t("opening") : t("viewAttachment")}
                      </button>
                    )}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        color:
                          r.status === "approved" ? "var(--teal)" : r.status === "rejected" ? "var(--danger)" : "var(--text-muted)",
                      }}
                    >
                      {t(`status_${r.status}`)}
                    </span>
                    {(r.status === "pending" || r.status === "approved") && (
                      <button type="button" disabled={isPending} onClick={() => handleCancel(r.id)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>
                        {t("cancelButton")}
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
