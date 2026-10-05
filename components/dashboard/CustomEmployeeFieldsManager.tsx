"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createCustomEmployeeField, deleteCustomEmployeeField, setCustomEmployeeFieldEditable } from "@/lib/employeeFile/actions";
import type { CustomEmployeeField } from "@/lib/employeeFile/constants";

// HR defines extra fields on every employee's file -- insurance number,
// tax ID, bank details, whatever the company's country or policy needs
// (organization_employee_fields, 0189). Each field is either something the
// employee fills in themselves or HR-only; the values live in the same
// private employee file (only the employee and admins can read them).
export default function CustomEmployeeFieldsManager({ organizationId, initialFields }: { organizationId: string; initialFields: CustomEmployeeField[] }) {
  const t = useTranslations("customEmployeeFields");
  const [isPending, startTransition] = useTransition();
  const [fields, setFields] = useState(initialFields);
  const [label, setLabel] = useState("");
  const [employeeEditable, setEmployeeEditable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return setError(t("nameError"));
    setError(null);
    startTransition(async () => {
      const result = await createCustomEmployeeField(organizationId, label, employeeEditable);
      if ("error" in result) return setError(result.error);
      setFields((prev) => [...prev, { id: result.id, label: label.trim(), employeeEditable }]);
      setLabel("");
    });
  }

  function handleToggleEditable(id: string, next: boolean) {
    const previous = fields;
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, employeeEditable: next } : f)));
    setError(null);
    startTransition(async () => {
      const result = await setCustomEmployeeFieldEditable(id, next);
      if ("error" in result) {
        setFields(previous);
        setError(result.error);
      }
    });
  }

  function handleRemove(f: CustomEmployeeField) {
    // Removing a field deletes what every employee entered for it -- not
    // something to do on a stray click.
    if (!window.confirm(t("confirmRemove", { label: f.label }))) return;
    const previous = fields;
    setFields((prev) => prev.filter((x) => x.id !== f.id));
    setError(null);
    startTransition(async () => {
      const result = await deleteCustomEmployeeField(f.id);
      if ("error" in result) {
        setFields(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("title")}</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6, maxWidth: 560 }}>{t("description")}</p>

      {fields.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>{t("noneYet")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", marginBottom: 14 }}>
          {fields.map((f) => (
            <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "8px 0", borderTop: "1px solid var(--border)", fontSize: 13.5 }}>
              <span style={{ color: "var(--text)" }}>{f.label}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}>
                  <input type="checkbox" checked={f.employeeEditable} disabled={isPending} onChange={(e) => handleToggleEditable(f.id, e.target.checked)} />
                  {t("employeeCanEdit")}
                </label>
                <button type="button" disabled={isPending} onClick={() => handleRemove(f)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>
                  {t("remove")}
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("namePlaceholder")}
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 14px", fontSize: 14, color: "var(--text)", outline: "none", flex: "1 1 220px" }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}>
          <input type="checkbox" checked={employeeEditable} onChange={(e) => setEmployeeEditable(e.target.checked)} />
          {t("employeeCanEdit")}
        </label>
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
