"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateOrganizationProfile } from "@/lib/organizations/actions";
import { EMPLOYEE_COUNT_RANGES, INDUSTRIES } from "@/lib/organizations/constants";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
};
const labelStyle: React.CSSProperties = { fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 6 };

export default function OrganizationProfileForm({
  organizationId,
  initial,
}: {
  organizationId: string;
  initial: { website: string | null; employeeCount: string | null; industry: string | null };
}) {
  const t = useTranslations("organizationProfileForm");
  const [website, setWebsite] = useState(initial.website ?? "");
  const [employeeCount, setEmployeeCount] = useState(initial.employeeCount ?? "");
  const [industry, setIndustry] = useState(initial.industry ?? "");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateOrganizationProfile(organizationId, { website, employeeCount, industry });
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
        {t("title")}
      </h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
        {t("description")}
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={labelStyle}>{t("websiteLabel")}</label>
          <input
            type="text"
            value={website}
            onChange={(e) => {
              setWebsite(e.target.value);
              setSaved(false);
            }}
            placeholder="acme.com"
            style={inputStyle}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <div>
            <label style={labelStyle}>{t("employeeCountLabel")}</label>
            <select
              value={employeeCount}
              onChange={(e) => {
                setEmployeeCount(e.target.value);
                setSaved(false);
              }}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="">{t("selectRange")}</option>
              {EMPLOYEE_COUNT_RANGES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>{t("industryLabel")}</label>
            <select
              value={industry}
              onChange={(e) => {
                setIndustry(e.target.value);
                setSaved(false);
              }}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="">{t("selectIndustry")}</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          style={{
            alignSelf: "flex-start",
            background: saved ? "rgba(var(--teal-rgb),0.1)" : "var(--teal)",
            color: saved ? "var(--teal)" : "#0A0F1E",
            border: saved ? "1px solid rgba(var(--teal-rgb),0.3)" : "none",
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {saved ? t("saved") : t("save")}
        </button>
      </form>
    </div>
  );
}
