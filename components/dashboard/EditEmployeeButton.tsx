"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateMemberDetails,
  setMemberArchived,
  adminScheduleEmployeeDataDeletion,
  adminCancelEmployeeDataDeletion,
  updateMemberPerformance,
} from "@/lib/organizations/actions";

const RATING_LABEL: Record<number, string> = {
  1: "1 — Below expectations",
  2: "2 — Developing",
  3: "3 — Meets expectations",
  4: "4 — Exceeds expectations",
  5: "5 — Outstanding",
};

const DELETE_CONFIRM_WORD = "DELETE";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13,
  color: "var(--text)",
  outline: "none",
};

export default function EditEmployeeButton({
  memberId,
  userId,
  name,
  initial,
  pendingDataDeletionAt = null,
  performanceRating = null,
  performanceRatingNote = "",
}: {
  memberId: string | null;
  // Needed for the data-deletion actions specifically — those key off the
  // auth user id (profiles.id), not the organization_members row id that
  // everything else here uses.
  userId: string;
  name: string;
  initial: {
    title: string | null;
    department: string | null;
    country: string | null;
    managerName: string | null;
    managerEmail: string | null;
    businessUnit: string | null;
    location: string | null;
  };
  pendingDataDeletionAt?: string | null;
  // Direct management input (migration 0068) — always optional, null means
  // simply not rated yet.
  performanceRating?: number | null;
  performanceRatingNote?: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initial.title ?? "");
  const [department, setDepartment] = useState(initial.department ?? "");
  const [country, setCountry] = useState(initial.country ?? "");
  const [managerName, setManagerName] = useState(initial.managerName ?? "");
  const [managerEmail, setManagerEmail] = useState(initial.managerEmail ?? "");
  const [businessUnit, setBusinessUnit] = useState(initial.businessUnit ?? "");
  const [location, setLocation] = useState(initial.location ?? "");
  const [rating, setRating] = useState(performanceRating ?? 0);
  const [ratingNote, setRatingNote] = useState(performanceRatingNote);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [scheduledFor, setScheduledFor] = useState(pendingDataDeletionAt);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  // memberId is null only before migration 0049 is run — show nothing
  // rather than a button that can't work.
  if (!memberId) return null;

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateMemberDetails(memberId!, {
        title,
        department,
        country,
        manager_name: managerName,
        manager_email: managerEmail,
        business_unit: businessUnit,
        location,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      setOpen(false);
    });
  }

  function archive() {
    setError(null);
    startTransition(async () => {
      const result = await setMemberArchived(memberId!, true);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      setOpen(false);
    });
  }

  function savePerformance() {
    setError(null);
    startTransition(async () => {
      const result = await updateMemberPerformance(memberId!, rating || null, ratingNote);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: "none",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "4px 10px",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Edit
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(3,8,16,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 24,
          }}
        >
          <div
            style={{
              background: "var(--navy-mid)",
              border: "1px solid rgba(0,201,167,0.3)",
              borderRadius: 20,
              padding: 28,
              maxWidth: 480,
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 20px 80px rgba(0,0,0,0.5)",
            }}
          >
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--text)", marginBottom: 16 }}>
              Edit {name}
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                Job title
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={fieldStyle} />
              </label>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                Department
                <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} style={fieldStyle} />
              </label>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                Business unit
                <input type="text" value={businessUnit} onChange={(e) => setBusinessUnit(e.target.value)} style={fieldStyle} />
              </label>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                Manager
                <input type="text" value={managerName} onChange={(e) => setManagerName(e.target.value)} style={fieldStyle} />
              </label>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                Manager email
                <input type="email" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} style={fieldStyle} />
              </label>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                Country
                <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} style={fieldStyle} />
              </label>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                Location / city
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} style={fieldStyle} />
              </label>
            </div>

            {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 12, lineHeight: 1.5 }}>{error}</p>}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={archive}
                disabled={isPending}
                style={{
                  background: "rgba(248,113,113,0.1)",
                  border: "1px solid rgba(248,113,113,0.35)",
                  borderRadius: 8,
                  padding: "9px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#f87171",
                  cursor: "pointer",
                }}
              >
                Archive employee
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={isPending}
                  style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
                >
                  {isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12, lineHeight: 1.5 }}>
              Archiving removes them from workforce views and analytics but keeps their history — it
              doesn&apos;t delete their account or data.
            </p>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
                Performance rating <span style={{ fontWeight: 400, textTransform: "none", color: "var(--text-muted)" }}>(optional)</span>
              </p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.5 }}>
                Direct input from you, not derived from any measured data — used only as an optional
                extra signal alongside the real competency data in reports and succession rankings.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <select value={rating} onChange={(e) => setRating(Number(e.target.value))} style={{ ...fieldStyle, cursor: "pointer" }}>
                  <option value={0}>— Not rated —</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {RATING_LABEL[n]}
                    </option>
                  ))}
                </select>
                <textarea
                  value={ratingNote}
                  onChange={(e) => setRatingNote(e.target.value)}
                  placeholder="Optional context for this rating"
                  rows={2}
                  style={{ ...fieldStyle, resize: "vertical" }}
                />
                <button
                  type="button"
                  onClick={savePerformance}
                  disabled={isPending}
                  style={{ alignSelf: "flex-start", background: "rgba(0,201,167,0.1)", border: "1px solid rgba(0,201,167,0.3)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "var(--teal)", cursor: "pointer" }}
                >
                  {isPending ? "Saving…" : "Save rating"}
                </button>
              </div>
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
                Data deletion
              </p>
              {scheduledFor ? (
                <div style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 10, padding: 14 }}>
                  <p style={{ fontSize: 12.5, color: "#f87171", fontWeight: 700, marginBottom: 4 }}>
                    Scheduled for deletion on {formatDate(scheduledFor)}
                  </p>
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.5 }}>
                    Their account still works normally until then. After that date this is permanent
                    and cannot be recovered.
                  </p>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await adminCancelEmployeeDataDeletion(userId);
                        if (result?.error) setError(result.error);
                        else setScheduledFor(null);
                      })
                    }
                    style={{ background: "rgba(0,201,167,0.1)", border: "1px solid rgba(0,201,167,0.3)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "var(--teal)", cursor: "pointer" }}
                  >
                    Cancel deletion
                  </button>
                </div>
              ) : confirmingDelete ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    Schedules {name}&apos;s plans, coach history, assessment results, gap analyses,
                    resume analysis, and tasks for deletion in 30 days. Employees can&apos;t trigger
                    this themselves — as their org admin, this is your call. Type{" "}
                    <strong style={{ color: "var(--text)" }}>{DELETE_CONFIRM_WORD}</strong> to confirm.
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder={DELETE_CONFIRM_WORD}
                      aria-label={`Type ${DELETE_CONFIRM_WORD} to confirm`}
                      style={{ ...fieldStyle, width: 140 }}
                    />
                    <button
                      type="button"
                      disabled={isPending || confirmText !== DELETE_CONFIRM_WORD}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await adminScheduleEmployeeDataDeletion(userId);
                          if (result?.error) setError(result.error);
                          else if (result?.deletionAt) {
                            setScheduledFor(result.deletionAt);
                            setConfirmingDelete(false);
                            setConfirmText("");
                          }
                        })
                      }
                      style={{
                        background: "rgba(248,113,113,0.12)",
                        border: "1px solid rgba(248,113,113,0.4)",
                        borderRadius: 8,
                        padding: "8px 14px",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#f87171",
                        cursor: confirmText === DELETE_CONFIRM_WORD ? "pointer" : "not-allowed",
                        opacity: isPending || confirmText !== DELETE_CONFIRM_WORD ? 0.5 : 1,
                      }}
                    >
                      {isPending ? "Scheduling…" : "Schedule deletion"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingDelete(false);
                        setConfirmText("");
                      }}
                      style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  style={{ background: "transparent", border: "1px solid rgba(248,113,113,0.4)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "#f87171", cursor: "pointer" }}
                >
                  Delete employee data
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
