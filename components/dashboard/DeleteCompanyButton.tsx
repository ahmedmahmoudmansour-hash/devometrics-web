"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { deleteOrganization, cancelOrganizationDeletion } from "@/lib/organizations/actions";

// Locale-aware, same ar-u-nu-latn (Western digits, Arabic month name)
// pattern already used for Pricing/legal-page dates elsewhere in the app.
function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-u-nu-latn" : "en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function DeleteCompanyButton({
  organizationId,
  organizationName,
  pendingDeletionAt,
}: {
  organizationId: string;
  organizationName: string;
  pendingDeletionAt: string | null;
}) {
  const t = useTranslations("deleteCompanyButton");
  const locale = useLocale();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [scheduledFor, setScheduledFor] = useState(pendingDeletionAt);
  const matches = confirmText.trim() === organizationName;

  // Already scheduled (from this visit or an earlier one) — offer to cancel
  // instead of the delete flow. Persists across reloads since it's read
  // from the organization row itself, not just local component state.
  if (scheduledFor) {
    return (
      <div style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 12, padding: 16 }}>
        <p style={{ fontSize: 13, color: "#f87171", fontWeight: 700, marginBottom: 4 }}>
          {t("scheduledTitle", { date: formatDate(scheduledFor, locale) })}
        </p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>
          {t("scheduledBody")}
        </p>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await cancelOrganizationDeletion(organizationId);
              if (result?.error) setError(result.error);
              else setScheduledFor(null);
            })
          }
          style={{
            background: "rgba(0,201,167,0.1)",
            border: "1px solid rgba(0,201,167,0.3)",
            borderRadius: 8,
            padding: "9px 16px",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--teal)",
            cursor: "pointer",
          }}
        >
          {isPending ? t("cancelling") : t("cancelDeletion")}
        </button>
        {error && <p style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>{error}</p>}
      </div>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        style={{
          background: "transparent",
          border: "1px solid rgba(248,113,113,0.4)",
          borderRadius: 8,
          padding: "10px 18px",
          fontSize: 13,
          fontWeight: 700,
          color: "#f87171",
          cursor: "pointer",
        }}
      >
        {t("deleteButton")}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
      <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
        {t("confirmBody", { orgName: organizationName })}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={organizationName}
          aria-label={t("confirmAria", { orgName: organizationName })}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(248,113,113,0.3)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            color: "var(--text)",
            outline: "none",
            width: 220,
          }}
        />
        <button
          type="button"
          disabled={isPending || !matches}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteOrganization(organizationId);
              if (result?.error) setError(result.error);
              else if (result?.deletionAt) setScheduledFor(result.deletionAt);
            })
          }
          style={{
            background: "rgba(248,113,113,0.12)",
            border: "1px solid rgba(248,113,113,0.4)",
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 13,
            fontWeight: 700,
            color: "#f87171",
            cursor: matches ? "pointer" : "not-allowed",
            opacity: isPending || !matches ? 0.5 : 1,
          }}
        >
          {isPending ? t("scheduling") : t("scheduleButton")}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setConfirmText("");
          }}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 13,
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          {t("cancel")}
        </button>
      </div>
      {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}
    </div>
  );
}
