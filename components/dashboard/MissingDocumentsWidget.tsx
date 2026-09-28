import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { MissingDocumentsItem } from "@/lib/organizations/missingDocuments";

const VISIBLE_ROWS = 8;

// Server component — items already fetched by the page rendering this
// (getMissingDocuments), same pattern as OverdueAssignmentsWidget. Renders
// nothing when the org hasn't marked anything required yet, or when
// everyone's fully documented — an admin who never turned this feature on
// shouldn't see an empty "attention" card.
export default async function MissingDocumentsWidget({ items }: { items: MissingDocumentsItem[] }) {
  if (items.length === 0) return null;

  const t = await getTranslations("missingDocumentsWidget");
  const visible = items.slice(0, VISIBLE_ROWS);
  const remaining = items.length - visible.length;

  return (
    <div style={{ background: "rgba(var(--amber-rgb),0.06)", border: "1px solid rgba(var(--amber-rgb),0.25)", borderRadius: 16, padding: 20 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>{t("title", { count: items.length })}</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((item) => (
          <Link
            key={item.employeeUserId}
            href={`/dashboard/company/${item.employeeUserId}/file`}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, fontSize: 12.5, textDecoration: "none" }}
          >
            <span style={{ color: "var(--text)" }}>
              <strong>{item.employeeName}</strong>
            </span>
            <span style={{ color: "var(--text-muted)", textAlign: "end" }}>{item.missingDocLabels.join(", ")}</span>
          </Link>
        ))}
      </div>

      {remaining > 0 && <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 10 }}>{t("andNMore", { count: remaining })}</p>}
    </div>
  );
}
