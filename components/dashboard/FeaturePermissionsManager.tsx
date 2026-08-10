"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { addFeatureRestriction, removeFeatureRestriction } from "@/lib/organizations/featureAccess";
import { RESTRICTABLE_FEATURES, type FeatureRestrictionRow, type RestrictableFeature } from "@/lib/organizations/featureAccessConstants";

const fieldStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
  width: "100%",
};
const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: 4,
  display: "block",
};

export default function FeaturePermissionsManager({
  organizationId,
  initialRestrictions,
  employees,
  departments,
}: {
  organizationId: string;
  initialRestrictions: FeatureRestrictionRow[];
  employees: { userId: string; name: string; email: string }[];
  departments: string[];
}) {
  const t = useTranslations("companyPermissionsPage");
  const router = useRouter();
  const [restrictions, setRestrictions] = useState(initialRestrictions);
  const [featureKey, setFeatureKey] = useState<RestrictableFeature>(RESTRICTABLE_FEATURES[0]);
  const [scopeType, setScopeType] = useState<"user" | "department">("user");
  const [userId, setUserId] = useState(employees[0]?.userId ?? "");
  const [department, setDepartment] = useState(departments[0] ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const scope = scopeType === "user" ? ({ type: "user", userId } as const) : ({ type: "department", department } as const);
    if (scopeType === "user" && !userId) return setError(t("pickEmployeeError"));
    if (scopeType === "department" && !department) return setError(t("pickDepartmentError"));

    startTransition(async () => {
      const result = await addFeatureRestriction(organizationId, featureKey, scope);
      if ("error" in result) {
        setError(result.error);
      } else {
        router.refresh();
        setRestrictions((prev) => [
          {
            id: result.id,
            featureKey,
            scopeType,
            userId: scopeType === "user" ? userId : null,
            userName: scopeType === "user" ? employees.find((e) => e.userId === userId)?.name ?? null : null,
            department: scopeType === "department" ? department : null,
          },
          ...prev,
        ]);
      }
    });
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      const result = await removeFeatureRestriction(organizationId, id);
      if (!("error" in result)) {
        setRestrictions((prev) => prev.filter((r) => r.id !== id));
        router.refresh();
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>{t("addRestrictionTitle")}</h2>
        <form onSubmit={handleAdd}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>{t("featureLabel")}</label>
              <select value={featureKey} onChange={(e) => setFeatureKey(e.target.value as RestrictableFeature)} style={fieldStyle}>
                {RESTRICTABLE_FEATURES.map((key) => (
                  <option key={key} value={key}>
                    {t(`feature_${key}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{t("scopeLabel")}</label>
              <select value={scopeType} onChange={(e) => setScopeType(e.target.value as "user" | "department")} style={fieldStyle}>
                <option value="user">{t("scopeUser")}</option>
                <option value="department">{t("scopeDepartment")}</option>
              </select>
            </div>
            {scopeType === "user" ? (
              <div>
                <label style={labelStyle}>{t("employeeLabel")}</label>
                <select value={userId} onChange={(e) => setUserId(e.target.value)} style={fieldStyle}>
                  {employees.map((emp) => (
                    <option key={emp.userId} value={emp.userId}>
                      {emp.name} ({emp.email})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label style={labelStyle}>{t("departmentLabel")}</label>
                {departments.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>{t("noDepartments")}</p>
                ) : (
                  <select value={department} onChange={(e) => setDepartment(e.target.value)} style={fieldStyle}>
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={isPending || (scopeType === "department" && departments.length === 0)}
            style={{
              background: "var(--teal)",
              color: "#0A0F1E",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? t("adding") : t("addButton")}
          </button>
          {error && <p style={{ color: "#f87171", fontSize: 13, marginTop: 10 }}>{error}</p>}
        </form>
      </div>

      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
          {t("currentRestrictionsTitle", { count: restrictions.length })}
        </h2>
        {restrictions.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("noRestrictions")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {restrictions.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 13,
                  padding: "10px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span style={{ color: "var(--text)" }}>
                  <strong>{t(`feature_${r.featureKey}`)}</strong>
                  <span style={{ color: "var(--text-muted)" }}>
                    {" "}
                    — {r.scopeType === "user" ? r.userName ?? t("unknownUser") : r.department}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleRemove(r.id)}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  {t("removeButton")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
