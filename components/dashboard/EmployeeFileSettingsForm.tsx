"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { FILE_SECTIONS } from "@/lib/employeeFile/constants";
import { setDisabledFileSections } from "@/lib/employeeFile/actions";

// Which optional parts of the employee file this company collects. The
// personal and employment details are always on; the rest is the company's
// call — a switched-off section disappears from every employee file.
export default function EmployeeFileSettingsForm({ organizationId, initialDisabled }: { organizationId: string; initialDisabled: string[] }) {
  const t = useTranslations("employeeFileSettings");
  const [isPending, startTransition] = useTransition();
  const [disabled, setDisabled] = useState(new Set(initialDisabled));
  const [error, setError] = useState<string | null>(null);

  function toggle(section: string, on: boolean) {
    const previous = disabled;
    const next = new Set(disabled);
    if (on) next.delete(section);
    else next.add(section);
    setDisabled(next);
    setError(null);
    startTransition(async () => {
      const result = await setDisabledFileSections(organizationId, [...next]);
      if ("error" in result) {
        setDisabled(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("title")}</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6, maxWidth: 560 }}>{t("description")}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {FILE_SECTIONS.map((section) => (
          <label key={section} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--text)", cursor: "pointer" }}>
            <input type="checkbox" checked={!disabled.has(section)} disabled={isPending} onChange={(e) => toggle(section, e.target.checked)} />
            {t(`section_${section}`)}
          </label>
        ))}
      </div>
      {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{error}</p>}
    </div>
  );
}
