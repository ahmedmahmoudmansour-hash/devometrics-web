"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createOrganization, joinOrganization } from "@/lib/organizations/actions";
import { EMPLOYEE_COUNT_RANGES, INDUSTRIES } from "@/lib/organizations/constants";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  padding: "12px 16px",
  fontSize: 15,
  color: "var(--text)",
  outline: "none",
};

export default function CompanySetupForm() {
  const t = useTranslations("companySetupForm");
  const [tab, setTab] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [industry, setIndustry] = useState("");
  const [adminTitle, setAdminTitle] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result =
        tab === "create"
          ? await createOrganization(name, { website, employeeCount, industry, adminTitle })
          : await joinOrganization(inviteCode);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 32 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {(["create", "join"] as const).map((tabOption) => (
          <button
            key={tabOption}
            type="button"
            onClick={() => {
              setTab(tabOption);
              setError(null);
            }}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              border: tab === tabOption ? "1px solid rgba(var(--teal-rgb),0.4)" : "1px solid var(--border)",
              background: tab === tabOption ? "rgba(var(--teal-rgb),0.12)" : "rgba(255,255,255,0.05)",
              color: tab === tabOption ? "var(--teal)" : "var(--text-muted)",
            }}
          >
            {tabOption === "create" ? t("createTab") : t("joinTab")}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {tab === "create" ? (
          <div>
            <label htmlFor="company-name" style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
              {t("companyNameLabel")}
            </label>
            <input
              id="company-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("companyNamePlaceholder")}
              style={inputStyle}
            />
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
              {t("companyNameHint")}
            </p>

            <label htmlFor="company-website" style={{ fontSize: 13, color: "var(--text-muted)", display: "block", margin: "16px 0 6px" }}>
              {t("companyWebsiteLabel")} <span style={{ color: "var(--text-muted)" }}>{t("optionalLabel")}</span>
            </label>
            <input
              id="company-website"
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder={t("companyWebsitePlaceholder")}
              style={inputStyle}
            />

            <label htmlFor="company-size" style={{ fontSize: 13, color: "var(--text-muted)", display: "block", margin: "16px 0 6px" }}>
              {t("employeeCountLabel")} <span style={{ color: "var(--text-muted)" }}>{t("optionalLabel")}</span>
            </label>
            <select
              id="company-size"
              value={employeeCount}
              onChange={(e) => setEmployeeCount(e.target.value)}
              style={inputStyle}
            >
              <option value="" style={{ color: "#000" }}>{t("selectRange")}</option>
              {EMPLOYEE_COUNT_RANGES.map((r) => (
                <option key={r} value={r} style={{ color: "#000" }}>{r}</option>
              ))}
            </select>

            <label htmlFor="company-industry" style={{ fontSize: 13, color: "var(--text-muted)", display: "block", margin: "16px 0 6px" }}>
              {t("industryLabel")} <span style={{ color: "var(--text-muted)" }}>{t("optionalLabel")}</span>
            </label>
            <select
              id="company-industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              style={inputStyle}
            >
              <option value="" style={{ color: "#000" }}>{t("selectIndustry")}</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i} style={{ color: "#000" }}>{i}</option>
              ))}
            </select>

            <label htmlFor="admin-title" style={{ fontSize: 13, color: "var(--text-muted)", display: "block", margin: "16px 0 6px" }}>
              {t("adminTitleLabel")} <span style={{ color: "var(--text-muted)" }}>{t("optionalLabel")}</span>
            </label>
            <input
              id="admin-title"
              type="text"
              value={adminTitle}
              onChange={(e) => setAdminTitle(e.target.value)}
              placeholder={t("adminTitlePlaceholder")}
              style={inputStyle}
            />
          </div>
        ) : (
          <div>
            <label htmlFor="invite-code" style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
              {t("inviteCodeLabel")}
            </label>
            <input
              id="invite-code"
              type="text"
              required
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder={t("inviteCodePlaceholder")}
              style={inputStyle}
            />
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
              {t("inviteCodeHint")}
            </p>
          </div>
        )}

        {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          style={{
            background: "var(--teal)",
            color: "#0A0F1E",
            border: "none",
            borderRadius: 10,
            padding: "13px",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? t("pleaseWait") : tab === "create" ? t("createSubmit") : t("joinSubmit")}
        </button>
      </form>
    </div>
  );
}
