"use client";

import { useState, useTransition } from "react";
import { deleteMyData } from "@/app/dashboard/actions";

export default function DataPrivacy() {
  const [confirming, setConfirming] = useState(false);
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
          <>
            <button
              type="button"
              disabled={isPending}
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
                cursor: "pointer",
              }}
            >
              {isPending ? "Deleting…" : "Confirm delete — this can't be undone"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
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
          </>
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
