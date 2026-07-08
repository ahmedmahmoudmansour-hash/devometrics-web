"use client";

import { useState, useTransition } from "react";
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
        {(["create", "join"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setError(null);
            }}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              border: tab === t ? "1px solid rgba(0,201,167,0.4)" : "1px solid var(--border)",
              background: tab === t ? "rgba(0,201,167,0.12)" : "rgba(255,255,255,0.05)",
              color: tab === t ? "var(--teal)" : "var(--text-muted)",
            }}
          >
            {t === "create" ? "Create a new company" : "Join with an invite code"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {tab === "create" ? (
          <div>
            <label htmlFor="company-name" style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
              Company name
            </label>
            <input
              id="company-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Inc."
              style={inputStyle}
            />
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
              You&apos;ll become this workspace&apos;s admin, with a private HR dashboard for your team —
              their individual tools work exactly the same as any other account.
            </p>

            <label htmlFor="company-website" style={{ fontSize: 13, color: "var(--text-muted)", display: "block", margin: "16px 0 6px" }}>
              Company website <span style={{ color: "var(--text-muted)" }}>(optional)</span>
            </label>
            <input
              id="company-website"
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="acme.com"
              style={inputStyle}
            />

            <label htmlFor="company-size" style={{ fontSize: 13, color: "var(--text-muted)", display: "block", margin: "16px 0 6px" }}>
              Number of employees <span style={{ color: "var(--text-muted)" }}>(optional)</span>
            </label>
            <select
              id="company-size"
              value={employeeCount}
              onChange={(e) => setEmployeeCount(e.target.value)}
              style={inputStyle}
            >
              <option value="" style={{ color: "#000" }}>Select a range</option>
              {EMPLOYEE_COUNT_RANGES.map((r) => (
                <option key={r} value={r} style={{ color: "#000" }}>{r}</option>
              ))}
            </select>

            <label htmlFor="company-industry" style={{ fontSize: 13, color: "var(--text-muted)", display: "block", margin: "16px 0 6px" }}>
              Industry <span style={{ color: "var(--text-muted)" }}>(optional)</span>
            </label>
            <select
              id="company-industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              style={inputStyle}
            >
              <option value="" style={{ color: "#000" }}>Select an industry</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i} style={{ color: "#000" }}>{i}</option>
              ))}
            </select>

            <label htmlFor="admin-title" style={{ fontSize: 13, color: "var(--text-muted)", display: "block", margin: "16px 0 6px" }}>
              Your title <span style={{ color: "var(--text-muted)" }}>(optional)</span>
            </label>
            <input
              id="admin-title"
              type="text"
              value={adminTitle}
              onChange={(e) => setAdminTitle(e.target.value)}
              placeholder="e.g. Head of HR"
              style={inputStyle}
            />
          </div>
        ) : (
          <div>
            <label htmlFor="invite-code" style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
              Invite code
            </label>
            <input
              id="invite-code"
              type="text"
              required
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="e.g. acme-inc-a1b2"
              style={inputStyle}
            />
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
              Ask your company&apos;s workspace admin for this code — it&apos;s shown on their company
              dashboard.
            </p>
          </div>
        )}

        {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}

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
          {isPending ? "Please wait…" : tab === "create" ? "Create company workspace" : "Join company"}
        </button>
      </form>
    </div>
  );
}
