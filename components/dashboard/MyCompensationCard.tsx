import { getTranslations } from "next-intl/server";
import type { CompensationRecord } from "@/lib/compensation/actions";

function formatAmount(amount: number | null, currency: string): string {
  if (amount === null) return "—";
  return `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

// Renders nothing when the employee has no compensation record at all —
// this feature is opt-in per organization, so most orgs/employees will
// never have one, and an empty card would be noise on every profile page.
export default async function MyCompensationCard({ records }: { records: CompensationRecord[] }) {
  if (records.length === 0) return null;
  const t = await getTranslations("myCompensationCard");
  const [current, ...history] = records;

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{t("title")}</h2>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 20, fontStyle: "italic" }}>{t("notPayrollNote")}</p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("currentAmount")}</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: "var(--teal)" }}>{formatAmount(current.amount, current.currency)}</span>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {t("effectiveSince", { date: new Date(current.effectiveFrom).toLocaleDateString(), frequency: t(`frequency_${current.payFrequency}`) })}
      </p>

      {current.monthlyDeductionAmount !== null && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
          {t("deductionLine", { amount: formatAmount(current.monthlyDeductionAmount, current.currency) })}
          {current.deductionNote ? ` — ${current.deductionNote}` : ""}
        </p>
      )}

      {history.length > 0 && (
        <details style={{ marginTop: 18 }}>
          <summary style={{ fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}>{t("historyTitle", { count: history.length })}</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            {history.map((r) => (
              <div key={r.id} style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                <span>{new Date(r.effectiveFrom).toLocaleDateString()} – {r.effectiveTo ? new Date(r.effectiveTo).toLocaleDateString() : t("present")}</span>
                <span style={{ color: "var(--text)" }}>{formatAmount(r.amount, r.currency)}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
