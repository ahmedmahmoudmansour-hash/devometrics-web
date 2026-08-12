"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { deleteMyData, cancelMyDataDeletion } from "@/app/dashboard/actions";

const CONFIRM_WORD = "DELETE";

function formatDate(iso: string, locale: string): string {
  const dateLocale = locale === "ar" ? "ar-u-nu-latn" : "en-US";
  return new Date(iso).toLocaleDateString(dateLocale, { month: "long", day: "numeric", year: "numeric" });
}

export default function DataPrivacy({
  pendingDataDeletionAt,
  organizationName,
}: {
  pendingDataDeletionAt: string | null;
  // Set only when the current user belongs to an organization — enterprise
  // employees can't self-delete their data (their org has a legitimate
  // governance interest in it), so the delete control is replaced with an
  // explanation instead of hidden outright, matching how deleteMyData()
  // enforces the same rule server-side.
  organizationName?: string | null;
}) {
  const t = useTranslations("dataPrivacy");
  const locale = useLocale();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [scheduledFor, setScheduledFor] = useState(pendingDataDeletionAt);

  return (
    <div
      style={{
        background: "var(--navy-mid)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 28,
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
        {t("title")}
      </h2>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
        {t("subtitlePrefix")}{" "}
        <a href="mailto:support@devometrics.com" style={{ color: "var(--teal)" }}>
          support@devometrics.com
        </a>
        .
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a
          href="/api/account/export"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--text)",
            textDecoration: "none",
          }}
        >
          {t("exportMyData")}
        </a>

        {organizationName && !scheduledFor ? (
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 16,
              width: "100%",
            }}
          >
            <p style={{ fontSize: 13, color: "var(--text)", fontWeight: 700, marginBottom: 4 }}>
              {t("managedByPrefix")} {organizationName}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
              {t("managedByBody")}
            </p>
          </div>
        ) : scheduledFor ? (
          <div
            style={{
              background: "rgba(var(--danger-rgb),0.06)",
              border: "1px solid rgba(var(--danger-rgb),0.3)",
              borderRadius: 12,
              padding: 16,
              width: "100%",
            }}
          >
            <p style={{ fontSize: 13, color: "var(--danger)", fontWeight: 700, marginBottom: 4 }}>
              {t("scheduledFor", { date: formatDate(scheduledFor, locale) })}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>
              {organizationName ? t("scheduledBodyOrg") : t("scheduledBodySelf")}
            </p>
            {!organizationName && (
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await cancelMyDataDeletion();
                  if (result?.error) setError(result.error);
                  else setScheduledFor(null);
                })
              }
              style={{
                background: "rgba(var(--teal-rgb),0.1)",
                border: "1px solid rgba(var(--teal-rgb),0.3)",
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
            )}
            {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{error}</p>}
          </div>
        ) : confirming ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
              {t("confirmBodyPrefix")}{" "}
              <strong style={{ color: "var(--text)" }}>{CONFIRM_WORD}</strong> {t("confirmBodySuffix")}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_WORD}
                aria-label={t("confirmWordAria", { word: CONFIRM_WORD })}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(var(--danger-rgb),0.3)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 13,
                  color: "var(--text)",
                  outline: "none",
                  width: 160,
                }}
              />
              <button
                type="button"
                disabled={isPending || confirmText !== CONFIRM_WORD}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteMyData();
                    if (result?.error) setError(result.error);
                    else if (result?.deletionAt) setScheduledFor(result.deletionAt);
                  })
                }
                style={{
                  background: "rgba(var(--danger-rgb),0.12)",
                  border: "1px solid rgba(var(--danger-rgb),0.4)",
                  borderRadius: 8,
                  padding: "10px 18px",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--danger)",
                  cursor: confirmText === CONFIRM_WORD ? "pointer" : "not-allowed",
                  opacity: isPending || confirmText !== CONFIRM_WORD ? 0.5 : 1,
                }}
              >
                {isPending ? t("scheduling") : t("scheduleDeletion")}
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
            {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            style={{
              background: "transparent",
              border: "1px solid rgba(var(--danger-rgb),0.4)",
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--danger)",
              cursor: "pointer",
            }}
          >
            {t("deleteMyData")}
          </button>
        )}
      </div>
    </div>
  );
}
