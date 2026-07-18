"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import {
  postAccountabilityCheckin,
  deleteAccountabilityCheckin,
  leaveAccountabilityGroup,
} from "@/lib/accountability/actions";
import type { AccountabilityGroup, AccountabilityGroupMember, AccountabilityCheckin } from "@/lib/accountability/types";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AccountabilityGroupDetail({
  group,
  members,
  checkins: initialCheckins,
  isCreator,
  currentUserId,
}: {
  group: AccountabilityGroup;
  members: AccountabilityGroupMember[];
  checkins: AccountabilityCheckin[];
  isCreator: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [checkins, setCheckins] = useState(initialCheckins);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await postAccountabilityCheckin(group.id, content);
      if (result?.error) setError(result.error);
      else {
        setContent("");
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteAccountabilityCheckin(id, group.id);
      if (!result?.error) setCheckins((prev) => prev.filter((c) => c.id !== id));
    });
  }

  function leave() {
    const prompt = isCreator
      ? `Leave ${group.name}? You created this group — it stays open for the remaining members.`
      : `Leave ${group.name}?`;
    if (!confirm(prompt)) return;
    startTransition(async () => {
      const result = await leaveAccountabilityGroup(group.id);
      if (!result?.error) router.push("/dashboard/accountability");
    });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 20, alignItems: "flex-start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <form onSubmit={submit} style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What are you working on? What's your progress or blocker?"
            style={{
              width: "100%",
              minHeight: 70,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 13.5,
              color: "var(--text)",
              outline: "none",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
          {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 6 }}>{error}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button
              type="submit"
              disabled={isPending || !content.trim()}
              style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: isPending || !content.trim() ? 0.6 : 1 }}
            >
              Post check-in
            </button>
          </div>
        </form>

        {checkins.length === 0 ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No check-ins yet — be the first to post.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {checkins.map((c) => (
              <div key={c.id} style={{ display: "flex", gap: 10, background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
                <Avatar name={c.full_name ?? "Member"} avatarUrl={c.avatar_url} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{c.full_name ?? "Member"}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{timeAgo(c.created_at)}</span>
                  </div>
                  <p style={{ fontSize: 13.5, color: "var(--text)", marginTop: 4, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{c.content}</p>
                  {c.user_id === currentUserId && (
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      style={{ marginTop: 6, background: "none", border: "none", color: "#f87171", fontSize: 11.5, cursor: "pointer", padding: 0 }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
            Members ({members.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {members.map((m) => (
              <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Avatar name={m.full_name ?? "Member"} avatarUrl={m.avatar_url} size={22} />
                <span style={{ fontSize: 12.5, color: "var(--text)" }}>{m.full_name ?? "Member"}</span>
                {group.created_by === m.user_id && <span style={{ fontSize: 10, color: "var(--amber)" }}>creator</span>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
            Invite code
          </p>
          <p style={{ fontSize: 16, fontWeight: 800, color: "var(--teal)", letterSpacing: "0.06em" }}>{group.invite_code}</p>
        </div>

        <button
          type="button"
          onClick={leave}
          disabled={isPending}
          style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#f87171", cursor: "pointer" }}
        >
          Leave group
        </button>
      </div>
    </div>
  );
}
