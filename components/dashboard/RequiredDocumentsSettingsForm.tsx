"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { REQUIRABLE_DOC_TYPES } from "@/lib/employeeFile/constants";
import { setRequiredDocTypes } from "@/lib/employeeFile/actions";

// Which employee-document types this company requires on file. Separate
// from EmployeeFileSettingsForm (which turns whole file SECTIONS on/off)
// -- this is a finer-grained "what counts as complete" setting that feeds
// MissingDocumentsWidget on the employees roster page, same
// checkbox-list-with-optimistic-toggle shape as that form.
export default function RequiredDocumentsSettingsForm({ organizationId, initialRequired }: { organizationId: string; initialRequired: string[] }) {
  const t = useTranslations("requiredDocumentsSettings");
  const tFile = useTranslations("employeeFile");
  const [isPending, startTransition] = useTransition();
  const [required, setRequired] = useState(new Set(initialRequired));
  const [error, setError] = useState<string | null>(null);

  function toggle(docType: string, on: boolean) {
    const previous = required;
    const next = new Set(required);
    if (on) next.add(docType);
    else next.delete(docType);
    setRequired(next);
    setError(null);
    startTransition(async () => {
      const result = await setRequiredDocTypes(organizationId, [...next]);
      if ("error" in result) {
        setRequired(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("title")}</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6, maxWidth: 560 }}>{t("description")}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {REQUIRABLE_DOC_TYPES.map((docType) => (
          <label key={docType} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--text)", cursor: "pointer" }}>
            <input type="checkbox" checked={required.has(docType)} disabled={isPending} onChange={(e) => toggle(docType, e.target.checked)} />
            {tFile(`doc_${docType}`)}
          </label>
        ))}
      </div>
      {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{error}</p>}
    </div>
  );
}
