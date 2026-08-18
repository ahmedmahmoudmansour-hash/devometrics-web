import { getTranslations } from "next-intl/server";
import type { OverdueAssignmentItem } from "@/lib/organizations/overdueAssignments";

const CATEGORY_LABEL_KEY: Record<OverdueAssignmentItem["category"], string> = {
  milestone: "categoryMilestone",
  assessment: "categoryAssessment",
  knowledgeHub: "categoryKnowledgeHub",
};

const VISIBLE_ROWS = 8;

// Server component — items are already fetched (getOverdueAssignments,
// which itself calls the get_overdue_assignments RPC, migration 0128) by
// the page rendering this, same pattern as every other admin widget that
// consumes buildCompanyData. Renders nothing when there's nothing overdue,
// same posture as CompanySetupGuide's collapsed-when-done state.
export default async function OverdueAssignmentsWidget({ items }: { items: OverdueAssignmentItem[] }) {
  if (items.length === 0) return null;

  const t = await getTranslations("overdueAssignmentsWidget");
  const counts = items.reduce<Record<OverdueAssignmentItem["category"], number>>(
    (acc, item) => {
      acc[item.category] += 1;
      return acc;
    },
    { milestone: 0, assessment: 0, knowledgeHub: 0 }
  );
  const visible = items.slice(0, VISIBLE_ROWS);
  const remaining = items.length - visible.length;

  return (
    <div style={{ background: "rgba(var(--amber-rgb),0.06)", border: "1px solid rgba(var(--amber-rgb),0.25)", borderRadius: 16, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{t("title", { count: items.length })}</h2>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(Object.keys(counts) as OverdueAssignmentItem["category"][])
            .filter((category) => counts[category] > 0)
            .map((category) => (
              <span
                key={category}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "rgb(var(--amber-rgb))",
                  background: "rgba(var(--amber-rgb),0.12)",
                  border: "1px solid rgba(var(--amber-rgb),0.3)",
                  borderRadius: 999,
                  padding: "3px 10px",
                }}
              >
                {t(CATEGORY_LABEL_KEY[category], { count: counts[category] })}
              </span>
            ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {visible.map((item, i) => (
          <div
            key={`${item.category}-${item.employeeUserId}-${i}`}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, fontSize: 12.5 }}
          >
            <span style={{ color: "var(--text)" }}>
              <strong>{item.employeeName ?? t("unknownEmployee")}</strong> — {item.title}
            </span>
            <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{t("dueOn", { date: new Date(item.dueDate).toLocaleDateString() })}</span>
          </div>
        ))}
      </div>

      {remaining > 0 && <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 10 }}>{t("andNMore", { count: remaining })}</p>}
    </div>
  );
}
