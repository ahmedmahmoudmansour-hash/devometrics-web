"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { withdrawCompensationProposal, type CompensationProposal } from "@/lib/compensation/actions";

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

// Proposals the current user personally submitted — list_compensation_proposals
// (0159) already scopes this to "own submissions" for a non-Comp-Admin
// caller, so this component never re-filters by author itself.
export default function MyCompensationProposals({
  initialProposals,
  employeeNames,
}: {
  initialProposals: CompensationProposal[];
  employeeNames: Record<string, { name: string; email: string }>;
}) {
  const t = useTranslations("myCompensationProposals");
  const router = useRouter();
  const [proposals, setProposals] = useState(initialProposals);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleWithdraw(proposalId: string) {
    setError(null);
    startTransition(async () => {
      const result = await withdrawCompensationProposal(proposalId);
      if ("error" in result) {
        setError(result.error);
      } else {
        setProposals((prev) => prev.map((p) => (p.id === proposalId ? { ...p, status: "withdrawn" } : p)));
        router.refresh();
      }
    });
  }

  const pending = proposals.filter((p) => p.status === "pending");
  if (pending.length === 0) return null;

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("title", { count: pending.length })}</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>{t("description")}</p>
      {error && <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 10 }}>{error}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {pending.map((p) => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, fontSize: 13, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
            <span style={{ color: "var(--text)" }}>
              {employeeNames[p.employeeUserId]?.name ?? t("unknownEmployee")} — {formatAmount(p.proposedAmount, p.proposedCurrency)}
            </span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleWithdraw(p.id)}
              style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              {t("withdrawButton")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
