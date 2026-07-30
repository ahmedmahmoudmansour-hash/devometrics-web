"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfileAiBudget, updateUserSubscriptionTier } from "@/lib/admin/profiles";
import type { PilotRow } from "@/lib/admin/aggregate";
import type { SubscriptionTier } from "@/lib/billing/subscriptionTier";

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

function AiBudgetCell({ row }: { row: PilotRow }) {
  const router = useRouter();
  const [value, setValue] = useState(row.monthlyAiBudgetUsd === null ? "" : String(row.monthlyAiBudgetUsd));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    const trimmed = value.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed === row.monthlyAiBudgetUsd) return;
    startTransition(async () => {
      const result = await updateProfileAiBudget(row.userId, parsed);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>$</span>
      <input
        type="number"
        min={0}
        step={0.01}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        placeholder="Unlimited"
        disabled={isPending}
        style={{
          width: 90,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "5px 8px",
          fontSize: 12,
          color: "var(--text)",
          outline: "none",
        }}
      />
      {error && <span style={{ fontSize: 10.5, color: "#f87171" }}>{error}</span>}
    </div>
  );
}

function SubscriptionTierCell({ row }: { row: PilotRow }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(tier: SubscriptionTier) {
    setError(null);
    if (tier === row.subscriptionTier) return;
    startTransition(async () => {
      const result = await updateUserSubscriptionTier(row.userId, tier);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  // Stored tier can differ from what actually applies right now (e.g. a
  // 'premium' trial that already expired reads as 'free' in practice) —
  // effectiveTier surfaces that instead of hiding it behind the dropdown.
  const trialLapsed = row.subscriptionTier !== "free" && row.effectiveTier === "free";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <select
        value={row.subscriptionTier}
        onChange={(e) => save(e.target.value as SubscriptionTier)}
        disabled={isPending}
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "5px 8px",
          fontSize: 12,
          color: "var(--text)",
          outline: "none",
        }}
      >
        <option value="free">Free</option>
        <option value="premium">Premium</option>
        <option value="enterprise">Enterprise</option>
      </select>
      {trialLapsed && (
        <span style={{ fontSize: 10.5, color: "var(--text-muted)" }} title="Trial expired — currently behaves as free">
          expired
        </span>
      )}
      {error && <span style={{ fontSize: 10.5, color: "#f87171" }}>{error}</span>}
    </div>
  );
}

export default function AdminPilotTable({ initial }: { initial: PilotRow[] }) {
  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...headStyle, textAlign: "left" }}>Name</th>
              <th style={{ ...headStyle, textAlign: "left" }}>Email</th>
              <th style={{ ...headStyle, textAlign: "left" }}>Organization</th>
              <th style={{ ...headStyle, textAlign: "left" }}>Subscription</th>
              <th style={{ ...headStyle, textAlign: "right" }}>Career Health Score</th>
              <th style={{ ...headStyle, textAlign: "right" }}>Assessments</th>
              <th style={{ ...headStyle, textAlign: "right" }}>Plans</th>
              <th style={{ ...headStyle, textAlign: "right" }}>Milestones</th>
              <th style={{ ...headStyle, textAlign: "right" }}>Joined</th>
              <th style={{ ...headStyle, textAlign: "right" }}>AI spend this month</th>
              <th style={{ ...headStyle, textAlign: "left" }}>Monthly AI budget</th>
            </tr>
          </thead>
          <tbody>
            {initial.length === 0 ? (
              <tr>
                <td style={cellStyle} colSpan={11}>
                  No pilot participants yet.
                </td>
              </tr>
            ) : (
              initial.map((r) => {
                const overBudget = r.monthlyAiBudgetUsd !== null && r.spendThisMonthUsd >= r.monthlyAiBudgetUsd;
                return (
                  <tr key={r.userId}>
                    <td style={cellStyle}>{r.name}</td>
                    <td style={cellStyle}>{r.email}</td>
                    <td style={{ ...cellStyle, color: r.organizationName ? "var(--text)" : "var(--text-muted)" }}>
                      {r.organizationName ?? "— individual —"}
                    </td>
                    <td style={cellStyle}>
                      <SubscriptionTierCell row={r} />
                    </td>
                    <td style={{ ...cellStyle, textAlign: "right", color: "var(--teal)", fontWeight: 700 }}>
                      {r.careerHealthScore ?? "—"}
                    </td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>
                      {r.assessmentsCompleted}/{r.totalAssessments}
                    </td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>{r.plans}</td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>
                      {r.milestonesDone}/{r.milestonesTotal}
                    </td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>
                      {new Date(r.joined).toLocaleDateString()}
                    </td>
                    <td style={{ ...cellStyle, textAlign: "right", color: overBudget ? "#f87171" : "var(--text)", fontWeight: overBudget ? 700 : 400 }}>
                      ${r.spendThisMonthUsd.toFixed(2)}
                    </td>
                    <td style={cellStyle}>
                      <AiBudgetCell row={r} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
