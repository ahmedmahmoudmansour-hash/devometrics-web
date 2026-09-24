"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { proposeOwnershipTransfer, cancelOwnershipTransfer, acceptOwnershipTransfer, type OwnershipInfo } from "@/lib/organizations/ownership";

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

// Who currently controls granting Compensation Admin (compensationAccess.ts
// / migration 0156's is_org_owner) — broader than compensation, but this is
// where the question naturally comes up. Two-step transfer: the current
// owner proposes, the proposed new owner accepts — see 0162's header for
// why an instant one-sided handoff was rejected.
export default function OrgOwnershipManager({
  organizationId,
  ownership,
  currentUserId,
  admins,
}: {
  organizationId: string;
  ownership: OwnershipInfo | null;
  currentUserId: string;
  admins: { userId: string; name: string; email: string }[];
}) {
  const t = useTranslations("orgOwnershipManager");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState("");

  if (!ownership) return null;

  const isOwner = ownership.ownerId === currentUserId;
  const isPendingTarget = ownership.pendingOwnerId === currentUserId;
  const eligibleTargets = admins.filter((a) => a.userId !== ownership.ownerId);

  function handlePropose(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedTarget) return setError(t("pickAdminError"));
    startTransition(async () => {
      const result = await proposeOwnershipTransfer(organizationId, selectedTarget);
      if ("error" in result) setError(result.error);
      else router.refresh();
    });
  }

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelOwnershipTransfer(organizationId);
      if (!("error" in result)) router.refresh();
    });
  }

  function handleAccept() {
    startTransition(async () => {
      const result = await acceptOwnershipTransfer(organizationId);
      if (!("error" in result)) router.refresh();
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("title")}</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6, maxWidth: 560 }}>{t("description")}</p>

      <p style={{ fontSize: 13, color: "var(--text)", marginBottom: isOwner || isPendingTarget ? 16 : 0 }}>
        {t("currentOwner", { name: ownership.ownerName ?? t("unknownUser") })}
      </p>

      {isPendingTarget && (
        <div style={{ border: "1px solid var(--teal)", borderRadius: 10, padding: 14, marginBottom: isOwner ? 16 : 0 }}>
          <p style={{ fontSize: 13, color: "var(--text)", marginBottom: 10 }}>{t("pendingForYouNote")}</p>
          <button type="button" disabled={isPending} onClick={handleAccept} style={btnPrimary}>
            {isPending ? t("accepting") : t("acceptButton")}
          </button>
        </div>
      )}

      {isOwner && ownership.pendingOwnerId && !isPendingTarget && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>
            {t("pendingTransferNote", { name: ownership.pendingOwnerName ?? t("unknownUser") })}
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={handleCancel}
            style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "var(--text)", cursor: "pointer" }}
          >
            {t("cancelTransferButton")}
          </button>
        </div>
      )}

      {isOwner && !ownership.pendingOwnerId && (
        <form onSubmit={handlePropose}>
          {eligibleTargets.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("noEligibleAdmins")}</p>
          ) : (
            <>
              <div style={{ marginBottom: 10, maxWidth: 320 }}>
                <label style={labelStyle}>{t("transferToLabel")}</label>
                <select value={selectedTarget} onChange={(e) => setSelectedTarget(e.target.value)} style={fieldStyle}>
                  <option value="">{t("selectAdminPlaceholder")}</option>
                  {eligibleTargets.map((a) => (
                    <option key={a.userId} value={a.userId}>
                      {a.name} ({a.email})
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={isPending} style={{ ...btnPrimary, opacity: isPending ? 0.6 : 1 }}>
                {isPending ? t("proposing") : t("proposeButton")}
              </button>
            </>
          )}
          {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{error}</p>}
        </form>
      )}
    </div>
  );
}
