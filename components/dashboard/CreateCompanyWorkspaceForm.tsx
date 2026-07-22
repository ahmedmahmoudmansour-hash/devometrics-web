"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCompanyWorkspace } from "@/lib/admin/organizations";

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13,
  color: "var(--text)",
  outline: "none",
  width: "100%",
};
const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: 6,
  display: "block",
};

export default function CreateCompanyWorkspaceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [seatLimit, setSeatLimit] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const trimmedSeat = seatLimit.trim();
    const parsedSeat = trimmedSeat === "" ? null : Number(trimmedSeat);
    startTransition(async () => {
      const result = await createCompanyWorkspace({
        name,
        adminEmail,
        seatLimit: parsedSeat,
        website: website || undefined,
        industry: industry || undefined,
        employeeCount: employeeCount || undefined,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      setName("");
      setAdminEmail("");
      setSeatLimit("");
      setWebsite("");
      setIndustry("");
      setEmployeeCount("");
      router.refresh();
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginBottom: 24 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Create a company workspace</h2>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2, marginBottom: 16 }}>
        Provisions the workspace and emails the person you name — they sign up with that address and are
        attached as its admin automatically. You are never a member of it yourself.
      </p>
      <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <div>
          <label style={labelStyle}>Company name</label>
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" required />
        </div>
        <div>
          <label style={labelStyle}>Founding admin email</label>
          <input
            style={inputStyle}
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="admin@acme.com"
            required
          />
        </div>
        <div>
          <label style={labelStyle}>Seat limit</label>
          <input
            style={inputStyle}
            type="number"
            min={0}
            value={seatLimit}
            onChange={(e) => setSeatLimit(e.target.value)}
            placeholder="Unlimited"
          />
        </div>
        <div>
          <label style={labelStyle}>Website</label>
          <input style={inputStyle} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="acme.com" />
        </div>
        <div>
          <label style={labelStyle}>Industry</label>
          <input style={inputStyle} value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="SaaS" />
        </div>
        <div>
          <label style={labelStyle}>Employee count</label>
          <input style={inputStyle} value={employeeCount} onChange={(e) => setEmployeeCount(e.target.value)} placeholder="51-200" />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button
            type="submit"
            disabled={isPending}
            style={{
              background: "var(--teal)",
              color: "#0A0F1E",
              fontWeight: 700,
              fontSize: 13,
              border: "none",
              borderRadius: 8,
              padding: "10px 18px",
              cursor: isPending ? "default" : "pointer",
              opacity: isPending ? 0.6 : 1,
              width: "100%",
            }}
          >
            {isPending ? "Creating…" : "Create workspace"}
          </button>
        </div>
      </form>
      {error && <p style={{ color: "#f87171", fontSize: 12.5, marginTop: 10 }}>{error}</p>}
      {success && <p style={{ color: "var(--teal)", fontSize: 12.5, marginTop: 10 }}>Workspace created — invite sent.</p>}
    </div>
  );
}
