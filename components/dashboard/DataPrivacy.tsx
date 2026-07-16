"use client";

import { useState, useTransition } from "react";
import { deleteMyData, cancelMyDataDeletion } from "@/app/dashboard/actions";

const CONFIRM_WORD = "DELETE";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
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
        Data & privacy
      </h2>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
        Export everything stored about you, or delete your app data. This does not
        delete your login — for full account deletion, contact{" "}
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
          Export my data
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
              Managed by {organizationName}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
              Your account is part of an organization workspace, so data deletion is handled by
              your HR admin rather than self-service — this keeps your performance history and
              records consistent for your employer&apos;s records. If you&apos;d like your data
              deleted, ask your admin to do it from their side.
            </p>
          </div>
        ) : scheduledFor ? (
          <div
            style={{
              background: "rgba(248,113,113,0.06)",
              border: "1px solid rgba(248,113,113,0.3)",
              borderRadius: 12,
              padding: 16,
              width: "100%",
            }}
          >
            <p style={{ fontSize: 13, color: "#f87171", fontWeight: 700, marginBottom: 4 }}>
              Scheduled for deletion on {formatDate(scheduledFor)}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>
              {organizationName
                ? `Your data still works normally until then. This was scheduled by your organization's admin — contact them if you'd like to cancel it. Once this date passes, everything is permanently removed and cannot be recovered.`
                : "Your data still works normally until then — cancel any time before that date. Once this date passes, everything is permanently removed and cannot be recovered."}
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
              {isPending ? "Cancelling…" : "Cancel deletion"}
            </button>
            )}
            {error && <p style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>{error}</p>}
          </div>
        ) : confirming ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
              This schedules your plans, coach history, assessment results, gap analyses, resume
              analysis, and tasks for deletion in 30 days — everything keeps working normally until
              then, and you can cancel any time before. After 30 days the deletion is permanent and
              we can no longer retrieve anything — this window exists purely to recover from a
              mistaken click, not as a general trash bin. Type{" "}
              <strong style={{ color: "var(--text)" }}>{CONFIRM_WORD}</strong> to confirm.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_WORD}
                aria-label={`Type ${CONFIRM_WORD} to confirm`}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(248,113,113,0.3)",
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
                  background: "rgba(248,113,113,0.12)",
                  border: "1px solid rgba(248,113,113,0.4)",
                  borderRadius: 8,
                  padding: "10px 18px",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#f87171",
                  cursor: confirmText === CONFIRM_WORD ? "pointer" : "not-allowed",
                  opacity: isPending || confirmText !== CONFIRM_WORD ? 0.5 : 1,
                }}
              >
                {isPending ? "Scheduling…" : "Schedule deletion (30-day grace period)"}
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
                Cancel
              </button>
            </div>
            {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}
          </div>
        ) : (
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
            Delete my data
          </button>
        )}
      </div>
    </div>
  );
}
