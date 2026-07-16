"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMemberRole } from "@/lib/jobArchitecture/actions";
import type { JobRole } from "@/lib/supabase/types";

// Places an employee into a role in the Job Architecture — the join that
// makes the mobility view computable (a person needs to be *in* a role to
// see where they can go from it). Grouped by grade descending so senior
// roles read first.
export default function MemberRoleSelector({
  memberId,
  currentRoleId,
  roles,
}: {
  memberId: string;
  currentRoleId: string | null;
  roles: JobRole[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState(currentRoleId ?? "");

  const sorted = [...roles].sort((a, b) => b.grade - a.grade);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Current role</label>
      <select
        value={value}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          setError(null);
          startTransition(async () => {
            const result = await setMemberRole(memberId, next || null);
            if (result?.error) {
              setError(result.error);
              setValue(currentRoleId ?? "");
            } else {
              router.refresh();
            }
          });
        }}
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8,
          padding: "8px 12px",
          fontSize: 13,
          color: "var(--text)",
          outline: "none",
          cursor: "pointer",
          minWidth: 220,
        }}
      >
        <option value="">— Not placed in a role —</option>
        {sorted.map((r) => (
          <option key={r.id} value={r.id}>
            {r.title} (G{r.grade}
            {r.level ? `, ${r.level}` : ""})
          </option>
        ))}
      </select>
      {isPending && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Saving…</span>}
      {error && <span style={{ fontSize: 12, color: "#f87171" }}>{error}</span>}
    </div>
  );
}
