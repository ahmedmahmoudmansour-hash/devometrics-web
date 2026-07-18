"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  createAccountabilityGroup,
  previewAccountabilityGroup,
  joinAccountabilityGroup,
  listMyAccountabilityGroups,
} from "@/lib/accountability/actions";
import type { AccountabilityGroupSummary } from "@/lib/accountability/types";

function inputStyle(): React.CSSProperties {
  return {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 13,
    color: "var(--text)",
    outline: "none",
    width: "100%",
  };
}

function CreateGroupForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createAccountabilityGroup(name, description);
      if (result?.error) setError(result.error);
      else if (result.group) {
        setCreatedCode(result.group.invite_code);
        setName("");
        setDescription("");
        onCreated();
      }
    });
  }

  if (createdCode) {
    return (
      <div style={{ background: "rgba(0,201,167,0.08)", border: "1px solid rgba(0,201,167,0.3)", borderRadius: 12, padding: 16 }}>
        <p style={{ fontSize: 13.5, color: "var(--text)", fontWeight: 700 }}>Group created — share this code to invite peers:</p>
        <p style={{ fontSize: 20, fontWeight: 800, color: "var(--teal)", letterSpacing: "0.08em", marginTop: 6 }}>{createdCode}</p>
        <button
          type="button"
          onClick={() => {
            setCreatedCode(null);
            setOpen(false);
          }}
          style={{ marginTop: 10, background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}
        >
          Done
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ background: "rgba(0,201,167,0.1)", border: "1px solid rgba(0,201,167,0.3)", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "var(--teal)", cursor: "pointer" }}
      >
        + Create group
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, display: "block" }}>Group name *</label>
        <input style={inputStyle()} value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="Product Design Study Group" />
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, display: "block" }}>What&apos;s the focus?</label>
        <input style={inputStyle()} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Weekly check-ins on our dev plans" />
      </div>
      {error && <p style={{ color: "#f87171", fontSize: 12 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={isPending} style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}>
          {isPending ? "Creating…" : "Create"}
        </button>
        <button type="button" onClick={() => setOpen(false)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function JoinGroupForm({ onJoined }: { onJoined: () => void }) {
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<{ id: string; name: string; description: string | null; member_count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function lookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPreview(null);
    startTransition(async () => {
      const result = await previewAccountabilityGroup(code);
      if (result?.error) setError(result.error);
      else if (result.group) setPreview(result.group);
    });
  }

  function confirmJoin() {
    startTransition(async () => {
      const result = await joinAccountabilityGroup(code);
      if (result?.error) setError(result.error);
      else {
        setPreview(null);
        setCode("");
        onJoined();
      }
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
      <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>Have an invite code?</p>
      <form onSubmit={lookup} style={{ display: "flex", gap: 8 }}>
        <input
          style={{ ...inputStyle(), textTransform: "uppercase", letterSpacing: "0.05em" }}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ABC123"
          maxLength={6}
        />
        <button type="submit" disabled={isPending || !code.trim()} style={{ background: "rgba(0,201,167,0.1)", border: "1px solid rgba(0,201,167,0.3)", borderRadius: 8, padding: "9px 16px", fontSize: 12.5, fontWeight: 700, color: "var(--teal)", cursor: "pointer", whiteSpace: "nowrap" }}>
          Look up
        </button>
      </form>
      {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>{error}</p>}
      {preview && (
        <div style={{ marginTop: 12, padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{preview.name}</p>
          {preview.description && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{preview.description}</p>}
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>{preview.member_count} member{preview.member_count === 1 ? "" : "s"}</p>
          <button
            type="button"
            onClick={confirmJoin}
            disabled={isPending}
            style={{ marginTop: 8, background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
          >
            {isPending ? "Joining…" : "Join this group"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function AccountabilityGroupsView({ initial }: { initial: AccountabilityGroupSummary[] }) {
  const [groups, setGroups] = useState(initial);
  const [, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const result = await listMyAccountabilityGroups();
      setGroups(result.groups);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <CreateGroupForm onCreated={refresh} />
        <JoinGroupForm onJoined={refresh} />
      </div>

      {groups.length === 0 ? (
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No groups yet — create one or join with an invite code above.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/dashboard/accountability/${g.id}`}
              style={{ display: "block", background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, textDecoration: "none" }}
              className="card-hover"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text)" }}>{g.name}</p>
                  {g.description && <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{g.description}</p>}
                </div>
                <span style={{ fontSize: 11.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                  {g.member_count} member{g.member_count === 1 ? "" : "s"}
                </span>
              </div>
              {g.latest_checkin && (
                <p style={{ fontSize: 11.5, color: "var(--teal)", marginTop: 8 }}>
                  Last check-in {new Date(g.latest_checkin).toLocaleDateString()}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
        Groups are peer-to-peer — your organization&apos;s admins have no visibility into who&apos;s in a
        group or what gets posted there.
      </p>
    </div>
  );
}
