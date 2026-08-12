"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  updateMemberDetails,
  setMemberArchived,
  setMemberRole,
  adminScheduleEmployeeDataDeletion,
  adminCancelEmployeeDataDeletion,
  updateMemberPerformance,
} from "@/lib/organizations/actions";

const DELETE_CONFIRM_WORD = "DELETE";

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-u-nu-latn" : "en-US", { month: "long", day: "numeric", year: "numeric" });
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
  role,
  isSelf = false,
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
    employeeId: string | null;
  };
  pendingDataDeletionAt?: string | null;
  // Direct management input (migration 0068) — always optional, null means
  // simply not rated yet.
  performanceRating?: number | null;
  performanceRatingNote?: string;
  // A company can have more than one admin — this just promotes/demotes
  // between the two roles organization_members actually has.
  role: "admin" | "member";
  isSelf?: boolean;
}) {
  const t = useTranslations("editEmployeeButton");
  const locale = useLocale();
  const RATING_LABEL: Record<number, string> = {
    1: t("rating1"),
    2: t("rating2"),
    3: t("rating3"),
    4: t("rating4"),
    5: t("rating5"),
  };
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initial.title ?? "");
  const [department, setDepartment] = useState(initial.department ?? "");
  const [country, setCountry] = useState(initial.country ?? "");
  const [managerName, setManagerName] = useState(initial.managerName ?? "");
  const [managerEmail, setManagerEmail] = useState(initial.managerEmail ?? "");
  const [businessUnit, setBusinessUnit] = useState(initial.businessUnit ?? "");
  const [location, setLocation] = useState(initial.location ?? "");
  const [employeeId, setEmployeeId] = useState(initial.employeeId ?? "");
  const [rating, setRating] = useState(performanceRating ?? 0);
  const [ratingNote, setRatingNote] = useState(performanceRatingNote);
  const [currentRole, setCurrentRole] = useState(role);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleSaving, setRoleSaving] = useState(false);
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
        employee_id: employeeId,
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

  function toggleRole() {
    const nextRole = currentRole === "admin" ? "member" : "admin";
    setRoleError(null);
    setRoleSaving(true);
    startTransition(async () => {
      const result = await setMemberRole(memberId!, nextRole);
      if (result?.error) {
        setRoleError(result.error);
      } else {
        setCurrentRole(nextRole);
        router.refresh();
      }
      setRoleSaving(false);
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
        {t("edit")}
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
              border: "1px solid rgba(var(--teal-rgb),0.3)",
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
              {t("editTitle", { name })}
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                {t("employeeIdLabel")}
                <input type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={fieldStyle} placeholder={t("employeeIdPlaceholder")} />
              </label>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                {t("jobTitleLabel")}
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={fieldStyle} />
              </label>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                {t("departmentLabel")}
                <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} style={fieldStyle} />
              </label>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                {t("businessUnitLabel")}
                <input type="text" value={businessUnit} onChange={(e) => setBusinessUnit(e.target.value)} style={fieldStyle} />
              </label>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                {t("managerLabel")}
                <input type="text" value={managerName} onChange={(e) => setManagerName(e.target.value)} style={fieldStyle} />
              </label>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                {t("managerEmailLabel")}
                <input type="email" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} style={fieldStyle} />
              </label>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                {t("countryLabel")}
                <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} style={fieldStyle} />
              </label>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                {t("locationLabel")}
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} style={fieldStyle} />
              </label>
            </div>

            {error && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 12, lineHeight: 1.5 }}>{error}</p>}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={archive}
                disabled={isPending}
                style={{
                  background: "rgba(var(--danger-rgb),0.1)",
                  border: "1px solid rgba(var(--danger-rgb),0.35)",
                  borderRadius: 8,
                  padding: "9px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--danger)",
                  cursor: "pointer",
                }}
              >
                {t("archiveEmployee")}
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={isPending}
                  style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
                >
                  {isPending ? t("saving") : t("save")}
                </button>
              </div>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12, lineHeight: 1.5 }}>
              {t("archiveNote")}
            </p>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
                {t("roleLabel")}
              </p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.5 }}>
                {t("roleDesc")}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: currentRole === "admin" ? "var(--amber)" : "var(--text-muted)",
                  }}
                >
                  {currentRole === "admin" ? t("roleAdmin") : t("roleMember")}
                </span>
                <button
                  type="button"
                  onClick={toggleRole}
                  disabled={roleSaving || (isSelf && currentRole === "admin")}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--text)",
                    cursor: roleSaving ? "wait" : "pointer",
                    opacity: roleSaving ? 0.6 : 1,
                  }}
                >
                  {roleSaving ? t("saving") : currentRole === "admin" ? t("removeAdminAccess") : t("makeAdmin")}
                </button>
              </div>
              {isSelf && currentRole === "admin" && (
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                  {t("askAnotherAdmin")}
                </p>
              )}
              {roleError && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{roleError}</p>}
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
                {t("performanceRatingLabel")} <span style={{ fontWeight: 400, textTransform: "none", color: "var(--text-muted)" }}>{t("optional")}</span>
              </p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.5 }}>
                {t("performanceRatingDesc")}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <select value={rating} onChange={(e) => setRating(Number(e.target.value))} style={{ ...fieldStyle, cursor: "pointer" }}>
                  <option value={0}>{t("notRated")}</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {RATING_LABEL[n]}
                    </option>
                  ))}
                </select>
                <textarea
                  value={ratingNote}
                  onChange={(e) => setRatingNote(e.target.value)}
                  placeholder={t("ratingNotePlaceholder")}
                  rows={2}
                  style={{ ...fieldStyle, resize: "vertical" }}
                />
                <button
                  type="button"
                  onClick={savePerformance}
                  disabled={isPending}
                  style={{ alignSelf: "flex-start", background: "rgba(var(--teal-rgb),0.1)", border: "1px solid rgba(var(--teal-rgb),0.3)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "var(--teal)", cursor: "pointer" }}
                >
                  {isPending ? t("saving") : t("saveRating")}
                </button>
              </div>
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
                {t("dataDeletion")}
              </p>
              {scheduledFor ? (
                <div style={{ background: "rgba(var(--danger-rgb),0.06)", border: "1px solid rgba(var(--danger-rgb),0.3)", borderRadius: 10, padding: 14 }}>
                  <p style={{ fontSize: 12.5, color: "var(--danger)", fontWeight: 700, marginBottom: 4 }}>
                    {t("scheduledForDeletion", { date: formatDate(scheduledFor, locale) })}
                  </p>
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.5 }}>
                    {t("scheduledForDeletionBody")}
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
                    style={{ background: "rgba(var(--teal-rgb),0.1)", border: "1px solid rgba(var(--teal-rgb),0.3)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "var(--teal)", cursor: "pointer" }}
                  >
                    {t("cancelDeletion")}
                  </button>
                </div>
              ) : confirmingDelete ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    {t("deleteConfirmBody", { name, word: DELETE_CONFIRM_WORD })}
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder={DELETE_CONFIRM_WORD}
                      aria-label={t("confirmAria", { word: DELETE_CONFIRM_WORD })}
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
                        background: "rgba(var(--danger-rgb),0.12)",
                        border: "1px solid rgba(var(--danger-rgb),0.4)",
                        borderRadius: 8,
                        padding: "8px 14px",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--danger)",
                        cursor: confirmText === DELETE_CONFIRM_WORD ? "pointer" : "not-allowed",
                        opacity: isPending || confirmText !== DELETE_CONFIRM_WORD ? 0.5 : 1,
                      }}
                    >
                      {isPending ? t("scheduling") : t("scheduleDeletion")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingDelete(false);
                        setConfirmText("");
                      }}
                      style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  style={{ background: "transparent", border: "1px solid rgba(var(--danger-rgb),0.4)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "var(--danger)", cursor: "pointer" }}
                >
                  {t("deleteEmployeeData")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
