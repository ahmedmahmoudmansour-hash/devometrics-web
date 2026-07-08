"use client";

import { useState, useTransition } from "react";
import { inviteEmployee, revokeInvite } from "@/lib/organizations/actions";

export default function InviteEmployeeForm({
  organizationId,
  pendingInvites,
}: {
  organizationId: string;
  pendingInvites: { id: string; email: string; title: string | null; department: string | null; country: string | null }[];
}) {
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await inviteEmployee(organizationId, email, title, department, country);
      if (result?.error) {
        setError(result.error);
      } else {
        setEmail("");
        setTitle("");
        setDepartment("");
        setCountry("");
      }
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
        Invite employees
      </h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
        Add their email — they&apos;ll be automatically attached to your company the moment they
        sign up with it, no invite code needed.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="employee@company.com"
          aria-label="Employee email to invite"
          style={{
            flex: "2 1 200px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 14,
            color: "var(--text)",
            outline: "none",
          }}
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Job title (optional)"
          aria-label="Employee job title"
          style={{
            flex: "1 1 150px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 14,
            color: "var(--text)",
            outline: "none",
          }}
        />
        <input
          type="text"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="Department (optional)"
          aria-label="Employee department"
          style={{
            flex: "1 1 150px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 14,
            color: "var(--text)",
            outline: "none",
          }}
        />
        <input
          type="text"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="Country (optional)"
          aria-label="Employee country"
          style={{
            flex: "1 1 130px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 14,
            color: "var(--text)",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={isPending}
          style={{
            background: "var(--teal)",
            color: "#0A0F1E",
            border: "none",
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            opacity: isPending ? 0.6 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {isPending ? "Sending…" : "Send invite"}
        </button>
      </form>
      {error && <p style={{ color: "#f87171", fontSize: 13, marginTop: 10 }}>{error}</p>}

      {pendingInvites.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Pending ({pendingInvites.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pendingInvites.map((invite) => (
              <div key={invite.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                <span style={{ color: "var(--text)" }}>
                  {invite.email}
                  {[invite.title, invite.department, invite.country].filter(Boolean).length > 0 && (
                    <span style={{ color: "var(--text-muted)" }}>
                      {" "}
                      — {[invite.title, invite.department, invite.country].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => startTransition(() => revokeInvite(invite.id))}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
