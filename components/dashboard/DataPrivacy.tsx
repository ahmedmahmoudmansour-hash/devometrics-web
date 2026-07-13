"use client";

import { useState, useTransition } from "react";
import { deleteMyData } from "@/app/dashboard/actions";

const CONFIRM_WORD = "DELETE";

export default function DataPrivacy() {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

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

        {done ? (
          <span style={{ fontSize: 13, color: "var(--teal)", alignSelf: "center" }}>
            Data deleted ✓
          </span>
        ) : confirming ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
              This permanently deletes your plans, coach history, assessment results, gap analyses,
              resume analysis, and tasks — with no way to recover them afterward. Type{" "}
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
                    await deleteMyData();
                    setDone(true);
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
                {isPending ? "Deleting…" : "Confirm delete — this can't be undone"}
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
