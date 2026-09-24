"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setDirectoryEnabled } from "@/lib/directory/actions";

// Off by default per org (0175) — an admin opts in here explicitly. Same
// "config, rarely visited" home as EmploymentHistoryVisibilityForm/
// leave's manager-visibility toggle, not its own settings page.
export default function DirectorySettingsForm({ organizationId, initialEnabled }: { organizationId: string; initialEnabled: boolean }) {
  const t = useTranslations("directorySettingsForm");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(initialEnabled);

  function handleChange(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      await setDirectoryEnabled(organizationId, next);
      router.refresh();
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
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8,
          padding: "10px 14px",
          fontSize: 14,
          color: "var(--text)",
          outline: "none",
          maxWidth: 300,
        }}
      >
        <option value="off">{t("off")}</option>
        <option value="on">{t("on")}</option>
      </select>
    </div>
  );
}
