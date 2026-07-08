"use client";

import { useState, useTransition } from "react";
import { updateOrganizationContacts } from "@/lib/organizations/actions";

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

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-muted)",
  display: "block",
  marginBottom: 6,
};

export default function OrganizationContactsForm({
  organizationId,
  initial,
}: {
  organizationId: string;
  initial: {
    platformContactName: string | null;
    platformContactEmail: string | null;
    financeContactName: string | null;
    financeContactEmail: string | null;
  };
}) {
  const [platformContactName, setPlatformContactName] = useState(initial.platformContactName ?? "");
  const [platformContactEmail, setPlatformContactEmail] = useState(initial.platformContactEmail ?? "");
  const [financeContactName, setFinanceContactName] = useState(initial.financeContactName ?? "");
  const [financeContactEmail, setFinanceContactEmail] = useState(initial.financeContactEmail ?? "");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateOrganizationContacts(organizationId, {
        platformContactName,
        platformContactEmail,
        financeContactName,
        financeContactEmail,
      });
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
        Company contacts
      </h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
        Optional — who we (or your team) should reach for day-to-day platform questions vs. billing.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <div>
            <label style={labelStyle}>Platform contact — name</label>
            <input
              type="text"
              value={platformContactName}
              onChange={(e) => {
                setPlatformContactName(e.target.value);
                setSaved(false);
              }}
              placeholder="e.g. Ahmed Mansour"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Platform contact — email</label>
            <input
              type="email"
              value={platformContactEmail}
              onChange={(e) => {
                setPlatformContactEmail(e.target.value);
                setSaved(false);
              }}
              placeholder="e.g. ops@company.com"
              style={inputStyle}
            />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <div>
            <label style={labelStyle}>Finance contact — name</label>
            <input
              type="text"
              value={financeContactName}
              onChange={(e) => {
                setFinanceContactName(e.target.value);
                setSaved(false);
              }}
              placeholder="e.g. Finance team lead"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Finance contact — email</label>
            <input
              type="email"
              value={financeContactEmail}
              onChange={(e) => {
                setFinanceContactEmail(e.target.value);
                setSaved(false);
              }}
              placeholder="e.g. billing@company.com"
              style={inputStyle}
            />
          </div>
        </div>

        {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          style={{
            alignSelf: "flex-start",
            background: saved ? "rgba(0,201,167,0.1)" : "var(--teal)",
            color: saved ? "var(--teal)" : "#0A0F1E",
            border: saved ? "1px solid rgba(0,201,167,0.3)" : "none",
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {saved ? "Saved" : "Save"}
        </button>
      </form>
    </div>
  );
}
