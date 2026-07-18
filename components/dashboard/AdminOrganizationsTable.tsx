"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrgSeatLimit } from "@/lib/admin/organizations";
import type { AdminOrganizationRow } from "@/lib/admin/organizations";

const cellStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 13,
  borderBottom: "1px solid var(--border)",
  color: "var(--text)",
};
const headStyle: React.CSSProperties = {
  ...cellStyle,
  color: "var(--text-muted)",
  fontWeight: 700,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  borderBottom: "1px solid var(--border)",
};

function SeatLimitCell({ org }: { org: AdminOrganizationRow }) {
  const router = useRouter();
  const [value, setValue] = useState(org.seatLimit === null ? "" : String(org.seatLimit));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const overLimit = org.seatLimit !== null && org.memberCount > org.seatLimit;

  function save() {
    setError(null);
    const trimmed = value.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed === org.seatLimit) return;
    startTransition(async () => {
      const result = await updateOrgSeatLimit(org.id, parsed);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        placeholder="Unlimited"
        disabled={isPending}
        style={{
          width: 80,
          background: "rgba(255,255,255,0.05)",
          border: `1px solid ${overLimit ? "#f87171" : "var(--border)"}`,
          borderRadius: 6,
          padding: "5px 8px",
          fontSize: 12,
          color: "var(--text)",
          outline: "none",
        }}
      />
      {overLimit && <span style={{ fontSize: 10.5, color: "#f87171", fontWeight: 700 }}>over</span>}
      {error && <span style={{ fontSize: 10.5, color: "#f87171" }}>{error}</span>}
    </div>
  );
}

export default function AdminOrganizationsTable({ initial }: { initial: AdminOrganizationRow[] }) {
  if (initial.length === 0) {
    return (
      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, marginBottom: 24 }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No company workspaces yet.</p>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", marginBottom: 24 }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Company seats</h2>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
          Set how many seats each company gets. Blank means unlimited. Enforced at the database level — a
          company can&apos;t add a new employee past its limit.
        </p>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...headStyle, textAlign: "left" }}>Organization</th>
              <th style={{ ...headStyle, textAlign: "right" }}>Members</th>
              <th style={{ ...headStyle, textAlign: "left" }}>Seat limit</th>
            </tr>
          </thead>
          <tbody>
            {initial.map((org) => (
              <tr key={org.id}>
                <td style={cellStyle}>{org.name}</td>
                <td style={{ ...cellStyle, textAlign: "right" }}>{org.memberCount}</td>
                <td style={cellStyle}>
                  <SeatLimitCell org={org} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
