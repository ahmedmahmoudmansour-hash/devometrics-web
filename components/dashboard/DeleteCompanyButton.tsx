"use client";

import { useState, useTransition } from "react";
import { deleteOrganization } from "@/lib/organizations/actions";

export default function DeleteCompanyButton({
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const matches = confirmText.trim() === organizationName;

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
        Delete company workspace
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
      <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
        This removes the workspace and every membership in it — permanently, with no way to
        recover it afterward. Employees keep their own individual accounts and data; they just
        stop being part of this company. Type <strong style={{ color: "var(--text)" }}>{organizationName}</strong>{" "}
        to confirm.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={organizationName}
          aria-label={`Type ${organizationName} to confirm`}
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
      {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}
    </div>
  );
}
