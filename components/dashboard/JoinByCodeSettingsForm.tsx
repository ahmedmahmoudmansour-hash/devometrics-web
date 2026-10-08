"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setJoinByCodeEnabled } from "@/lib/organizations/joinByCode";

// Off by default (0190). Email invites are the safe way to add people; this
// is only for a company that deliberately wants a shareable code.
export default function JoinByCodeSettingsForm({ organizationId, initialEnabled }: { organizationId: string; initialEnabled: boolean }) {
  const t = useTranslations("joinByCodeSettings");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);

  function handleChange(next: boolean) {
    const previous = enabled;
    setEnabled(next);
    setError(null);
    startTransition(async () => {
      const result = await setJoinByCodeEnabled(organizationId, next);
      if ("error" in result) {
        setEnabled(previous);
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("title")}</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6, maxWidth: 560 }}>{t("description")}</p>
      <select
        value={enabled ? "on" : "off"}
        onChange={(e) => handleChange(e.target.value === "on")}
        disabled={isPending}
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 14px", fontSize: 14, color: "var(--text)", outline: "none", maxWidth: 360 }}
      >
        <option value="off">{t("off")}</option>
        <option value="on">{t("on")}</option>
      </select>
      {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{error}</p>}
    </div>
  );
}
