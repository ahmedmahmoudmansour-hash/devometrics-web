"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { leaveOrganization } from "@/lib/organizations/actions";

export default function CompanyMembershipCard({ organizationName }: { organizationName: string }) {
  const t = useTranslations("companyMembershipCard");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{t("title")}</h2>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
        {t("subtitlePrefix")} <strong style={{ color: "var(--text)" }}>{organizationName}</strong>. {t("subtitleSuffix")}
      </p>

      {left ? (
        <span style={{ fontSize: 13, color: "var(--teal)" }}>{t("left")}</span>
      ) : confirming ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
          {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await leaveOrganization();
                  if (result?.error) setError(result.error);
                  else setLeft(true);
                })
              }
              style={{
                background: "rgba(var(--danger-rgb),0.12)",
                border: "1px solid rgba(var(--danger-rgb),0.4)",
                borderRadius: 8,
                padding: "10px 18px",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--danger)",
                cursor: "pointer",
              }}
            >
              {isPending ? t("leaving") : t("confirmLeave")}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 18px", fontSize: 13, color: "var(--text-muted)", cursor: "pointer" }}
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          style={{
            background: "transparent",
            border: "1px solid rgba(var(--danger-rgb),0.4)",
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--danger)",
            cursor: "pointer",
          }}
        >
          {t("leaveCompany")}
        </button>
      )}
    </div>
  );
}
