"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createCustomDocumentType, deleteCustomDocumentType } from "@/lib/employeeFile/actions";
import type { OrgDocumentType } from "@/lib/employeeFile/constants";

// Lets HR define its own document types beyond the 6 fixed ones (e.g.
// "NDA", "Background check consent") -- organization_document_types
// (0188). A new type immediately becomes selectable in the upload
// dropdown (EmployeeFileEditor, HR mode) and pickable as "required"
// (RequiredDocumentsSettingsForm) on this same settings page.
export default function CustomDocumentTypesManager({ organizationId, initialTypes }: { organizationId: string; initialTypes: OrgDocumentType[] }) {
  const t = useTranslations("customDocumentTypes");
  const [isPending, startTransition] = useTransition();
  const [types, setTypes] = useState(initialTypes);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return setError(t("nameError"));
    setError(null);
    startTransition(async () => {
      const result = await createCustomDocumentType(organizationId, label);
      if ("error" in result) return setError(result.error);
      setTypes((prev) => [...prev, { id: result.id, label: label.trim() }]);
      setLabel("");
    });
  }

  function handleRemove(id: string) {
    const previous = types;
    setTypes((prev) => prev.filter((d) => d.id !== id));
    startTransition(async () => {
      const result = await deleteCustomDocumentType(id);
      if ("error" in result) {
        setTypes(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("title")}</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6, maxWidth: 560 }}>{t("description")}</p>

      {types.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>{t("noneYet")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", marginBottom: 14 }}>
          {types.map((d) => (
            <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--border)", fontSize: 13.5 }}>
              <span style={{ color: "var(--text)" }}>{d.label}</span>
              <button type="button" disabled={isPending} onClick={() => handleRemove(d.id)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>
                {t("remove")}
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("namePlaceholder")}
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 14px", fontSize: 14, color: "var(--text)", outline: "none", flex: "1 1 220px" }}
        />
        <button
          type="submit"
          disabled={isPending}
          style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
        >
          {t("addButton")}
        </button>
      </form>
      {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{error}</p>}
    </div>
  );
}
