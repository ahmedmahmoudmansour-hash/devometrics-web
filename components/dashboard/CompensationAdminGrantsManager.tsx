"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { grantCompensationAdmin, revokeCompensationAdmin, type CompensationAdminGrant } from "@/lib/organizations/compensationAccess";

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

// A grant-list, not a deny-list — structurally the inverse of
// FeaturePermissionsManager.tsx. Deliberately its own component rather than
// a reuse: "who gets a narrow additional permission" and "who loses a
// default-on feature" are different mental models even though the form/list
// shape looks similar.
export default function CompensationAdminGrantsManager({
  organizationId,
  initialGrants,
  employees,
  isOwner,
}: {
  organizationId: string;
  initialGrants: CompensationAdminGrant[];
  employees: { userId: string; name: string; email: string }[];
  // Only the org's owner (organizations.created_by) can grant/revoke this —
  // any admin can grant/revoke a FeaturePermissionsManager restriction, but
  // salary-wide visibility is deliberately a narrower decision than "is an
  // admin" (see compensationAccess.ts's requireOrgOwner). A non-owner admin
  // gets a read-only note instead of a form that would fail on submit.
  isOwner: boolean;
}) {
  const t = useTranslations("compensationAdminGrants");
  const router = useRouter();
  const [grants, setGrants] = useState(initialGrants);
  const grantedUserIds = new Set(grants.map((g) => g.userId));
  const grantableEmployees = employees.filter((e) => !grantedUserIds.has(e.userId));
  const [userId, setUserId] = useState(grantableEmployees[0]?.userId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!userId) return setError(t("pickEmployeeError"));

    startTransition(async () => {
      const result = await grantCompensationAdmin(organizationId, userId);
      if ("error" in result) {
        setError(result.error);
      } else {
        router.refresh();
        const employee = employees.find((e) => e.userId === userId);
        setGrants((prev) => [
          { id: `${userId}-pending`, userId, userName: employee?.name ?? null, grantedAt: new Date().toISOString() },
          ...prev,
        ]);
      }
    });
  }

  function handleRevoke(id: string) {
    startTransition(async () => {
      const result = await revokeCompensationAdmin(organizationId, id);
      if (!("error" in result)) {
        setGrants((prev) => prev.filter((g) => g.id !== id));
        router.refresh();
      }
    });
  }

  if (!isOwner) {
    return (
      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("title")}</h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, maxWidth: 560 }}>{t("ownerOnlyNote")}</p>
        {/* RLS (0156) scopes a non-owner's own listCompensationAdmins query to just their own grant row, if any — so a non-empty list here means "I have this access", never someone else's data leaking through. */}
        {grants.length > 0 && <p style={{ fontSize: 12, color: "var(--teal)", marginTop: 10 }}>{t("youHaveAccessNote")}</p>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("title")}</h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6, maxWidth: 560 }}>
          {t("description")}
        </p>
        <form onSubmit={handleGrant}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>{t("employeeLabel")}</label>
              {grantableEmployees.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>{t("everyoneGranted")}</p>
              ) : (
                <select value={userId} onChange={(e) => setUserId(e.target.value)} style={fieldStyle}>
                  {grantableEmployees.map((emp) => (
                    <option key={emp.userId} value={emp.userId}>
                      {emp.name} ({emp.email})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <button
            type="submit"
            disabled={isPending || grantableEmployees.length === 0}
            style={{
              background: "var(--teal)",
              color: "#0A0F1E",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              opacity: isPending || grantableEmployees.length === 0 ? 0.6 : 1,
            }}
          >
            {isPending ? t("granting") : t("grantButton")}
          </button>
          {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{error}</p>}
        </form>
      </div>

      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
          {t("currentGrantsTitle", { count: grants.length })}
        </h2>
        {grants.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("noGrants")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {grants.map((g) => (
              <div
                key={g.id}
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
                <span style={{ color: "var(--text)" }}>{g.userName ?? t("unknownUser")}</span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleRevoke(g.id)}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  {t("revokeButton")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
