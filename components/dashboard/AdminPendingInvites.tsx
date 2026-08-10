"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { revokeInvite } from "@/lib/organizations/actions";
import type { PendingInviteRow } from "@/lib/admin/aggregate";

// Everyone in buildPilotRows() already has a profiles row, which only
// exists once someone actually signs up — an invite that's never been
// accepted has no auth.users row and so never appears in that table at
// all. This is the one place on the platform-admin page that reads
// organization_invites directly instead, so an invite stuck at "sent,
// never logged in" isn't invisible to platform admins the way it
// otherwise would be.
export default function AdminPendingInvites({ initial }: { initial: PendingInviteRow[] }) {
  const t = useTranslations("adminPage");
  const [invites, setInvites] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [revokingId, setRevokingId] = useState<string | null>(null);

  if (invites.length === 0) return null;

  function handleRevoke(id: string) {
    setRevokingId(id);
    startTransition(async () => {
      await revokeInvite(id);
      setInvites((prev) => prev.filter((i) => i.id !== id));
      setRevokingId(null);
    });
  }

  return (
    <div
      style={{
        background: "var(--navy-mid)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
      }}
    >
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
        {t("pendingInvitesTitle", { count: invites.length })}
      </h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
        {t("pendingInvitesDescription")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {invites.map((invite) => (
          <div
            key={invite.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              fontSize: 13,
              padding: "8px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span style={{ color: "var(--text)" }}>
              {invite.email}
              <span style={{ color: "var(--text-muted)" }}>
                {" "}
                — {invite.organizationName}
                {invite.title ? ` · ${invite.title}` : ""}
              </span>
            </span>
            <button
              type="button"
              disabled={isPending && revokingId === invite.id}
              onClick={() => handleRevoke(invite.id)}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                fontSize: 12,
                cursor: "pointer",
                opacity: isPending && revokingId === invite.id ? 0.6 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {t("revokeInvite")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
