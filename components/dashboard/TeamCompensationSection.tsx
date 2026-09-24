"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { proposeCompensationChange, type TeamCompensationRow, type SalaryBand } from "@/lib/compensation/actions";

const fieldStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  color: "var(--text)",
  outline: "none",
  width: "100%",
};
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, display: "block" };

function formatAmount(amount: number | null, currency: string): string {
  if (amount === null) return "—";
  return `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function bandRangeLabel(band: SalaryBand | undefined, currency: string): string {
  if (!band) return "—";
  return `${formatAmount(band.minAmount, currency)} – ${formatAmount(band.maxAmount, currency)}`;
}

// Redaction ('exact' full amount / 'band' range-only / 'none' excluded
// entirely) already happened server-side in list_team_compensation — this
// component only renders what it was handed, never re-derives visibility.
export default function TeamCompensationSection({
  organizationId,
  initialRows,
  salaryBands,
  employeeNames,
}: {
  organizationId: string;
  initialRows: TeamCompensationRow[];
  salaryBands: SalaryBand[];
  employeeNames: Record<string, { name: string; email: string }>;
}) {
  const t = useTranslations("teamCompensationSection");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [proposingFor, setProposingFor] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [bandId, setBandId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reason, setReason] = useState("");
  const [deductionAmount, setDeductionAmount] = useState("");
  const [deductionNote, setDeductionNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const bandById = new Map(salaryBands.map((b) => [b.id, b]));

  function openProposeForm(employeeUserId: string, defaultCurrency: string) {
    setProposingFor(employeeUserId);
    setAmount("");
    setCurrency(defaultCurrency);
    setBandId("");
    setEffectiveDate("");
    setReason("");
    setDeductionAmount("");
    setDeductionNote("");
    setError(null);
  }

  // Picking a band fills in its default deduction reference as a starting
  // point — still freely editable, purely informational either way (0165).
  function handleBandChange(newBandId: string) {
    setBandId(newBandId);
    const band = bandById.get(newBandId);
    if (band) {
      if (deductionAmount.trim() === "" && band.defaultMonthlyDeductionAmount !== null) {
        setDeductionAmount(String(band.defaultMonthlyDeductionAmount));
      }
      if (deductionNote.trim() === "" && band.defaultDeductionNote) {
        setDeductionNote(band.defaultDeductionNote);
      }
    }
  }

  function handleSubmitProposal(e: React.FormEvent) {
    e.preventDefault();
    if (!proposingFor) return;
    setError(null);
    const proposedAmount = Number(amount);
    if (!Number.isFinite(proposedAmount) || proposedAmount < 0) return setError(t("invalidAmount"));
    if (!effectiveDate) return setError(t("pickDateError"));
    const proposedDeductionAmount = deductionAmount.trim() === "" ? null : Number(deductionAmount);

    startTransition(async () => {
      const result = await proposeCompensationChange({
        organizationId,
        employeeUserId: proposingFor,
        proposedAmount,
        proposedCurrency: currency,
        proposedSalaryBandId: bandId || null,
        proposedEffectiveDate: effectiveDate,
        reason: reason.trim() || null,
        proposedMonthlyDeductionAmount: proposedDeductionAmount,
        proposedDeductionNote: deductionNote.trim() || null,
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccess(t("proposalSubmitted"));
        setProposingFor(null);
        router.refresh();
      }
    });
  }

  if (initialRows.length === 0) return null;

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("title")}</h2>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 16, fontStyle: "italic" }}>{t("notPayrollNote")}</p>
      {success && <p style={{ color: "var(--teal)", fontSize: 12, marginBottom: 12 }}>{success}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {initialRows.map((row) => (
          <div key={row.employeeUserId} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{employeeNames[row.employeeUserId]?.name ?? t("unknownEmployee")}</span>
              <span style={{ fontSize: 13, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                {row.visibility === "exact" ? formatAmount(row.amount, row.currency) : bandRangeLabel(bandById.get(row.salaryBandId ?? ""), row.currency)}
              </span>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
              {t(`frequency_${row.payFrequency}`)} · {t("effectiveSince", { date: new Date(row.effectiveFrom).toLocaleDateString() })}
              {row.monthlyDeductionAmount !== null &&
                ` · ${t("deductionAmountLabel")}: ${formatAmount(row.monthlyDeductionAmount, row.currency)}${row.deductionNote ? ` (${row.deductionNote})` : ""}`}
            </p>

            {proposingFor === row.employeeUserId ? (
              <form onSubmit={handleSubmitProposal} style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 10 }}>
                  <div>
                    <label style={labelStyle}>{t("newAmountLabel")}</label>
                    <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" style={fieldStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t("currencyLabel")}</label>
                    <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} style={fieldStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t("effectiveDateLabel")}</label>
                    <input value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} type="date" style={fieldStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t("bandLabel")}</label>
                    <select value={bandId} onChange={(e) => handleBandChange(e.target.value)} style={fieldStyle}>
                      <option value="">{t("noBandOption")}</option>
                      {salaryBands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>{t("deductionAmountLabel")}</label>
                    <input value={deductionAmount} onChange={(e) => setDeductionAmount(e.target.value)} type="number" style={fieldStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t("deductionNoteLabel")}</label>
                    <input value={deductionNote} onChange={(e) => setDeductionNote(e.target.value)} placeholder={t("deductionNotePlaceholder")} style={fieldStyle} />
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>{t("reasonLabel")}</label>
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} style={{ ...fieldStyle, resize: "vertical" }} />
                </div>
                <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 10, fontStyle: "italic" }}>{t("deductionDisclaimer")}</p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="submit" disabled={isPending} style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}>
                    {isPending ? t("submitting") : t("submitButton")}
                  </button>
                  <button type="button" onClick={() => setProposingFor(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>
                    {t("cancelButton")}
                  </button>
                </div>
                {error && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{error}</p>}
              </form>
            ) : (
              <button
                type="button"
                onClick={() => openProposeForm(row.employeeUserId, row.currency)}
                style={{ marginTop: 10, background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "var(--text)", cursor: "pointer" }}
              >
                {t("proposeChangeButton")}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
