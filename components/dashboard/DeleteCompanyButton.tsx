"use client";

import { useState, useTransition } from "react";
import { deleteOrganization } from "@/lib/organizations/actions";

export default function DeleteCompanyButton({ organizationId }: { organizationId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
      <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
        This removes the workspace and every membership in it — permanently. Employees keep their
        own individual accounts and data; they just stop being part of this company.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          disabled={isPending}
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
      </div>
      {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}
    </div>
  );
}
