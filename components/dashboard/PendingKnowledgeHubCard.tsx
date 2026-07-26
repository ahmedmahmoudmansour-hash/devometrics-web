import Link from "next/link";
import { useTranslations } from "next-intl";
import type { PendingKnowledgeHubItem } from "@/lib/knowledgeHub/actions";

// Same shape as TodayTasksCard — whole card links out, amber border when
// anything's overdue, top items listed with a "+N more" overflow.
export default function PendingKnowledgeHubCard({ items }: { items: PendingKnowledgeHubItem[] }) {
  const t = useTranslations("pendingKnowledgeHubCard");
  if (items.length === 0) return null;

  const overdue = items.filter((i) => i.overdue);
  const upcoming = items.filter((i) => !i.overdue);

  return (
    <Link
      href="/dashboard/knowledge-hub"
      style={{
        display: "block",
        background: "var(--navy-mid)",
        border: overdue.length > 0 ? "1px solid rgba(240,184,64,0.35)" : "1px solid var(--border)",
        borderRadius: 16,
        padding: 20,
        textDecoration: "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{t("title")}</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {overdue.length > 0
              ? t("overdueTotal", { overdue: overdue.length, total: items.length })
              : items.length === 1
              ? t("itemsAssignedOne")
              : t("itemsAssignedMany", { count: items.length })}
          </p>
        </div>
        <span style={{ fontSize: 20, fontWeight: 800, color: overdue.length > 0 ? "var(--amber)" : "var(--teal)" }}>
          {items.length}
        </span>
      </div>

      {upcoming.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
          {upcoming.slice(0, 3).map((i) => (
            <p key={i.contentId} style={{ fontSize: 12.5, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              ○ {i.title}
              {i.dueDate ? <span style={{ color: "var(--text-muted)", fontSize: 11 }}> {t("dueDate", { date: i.dueDate })}</span> : null}
            </p>
          ))}
          {upcoming.length > 3 && (
            <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t("moreCount", { count: upcoming.length - 3 })}</p>
          )}
        </div>
      )}

      {overdue.length > 0 && (
        <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--amber)", marginBottom: 4 }}>
            {t("overdueLabel", { count: overdue.length })}
          </p>
          {overdue.slice(0, 3).map((i) => (
            <p key={i.contentId} style={{ fontSize: 12.5, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              ○ {i.title} <span style={{ fontSize: 11 }}>{t("wasDue", { date: i.dueDate ?? "" })}</span>
            </p>
          ))}
          {overdue.length > 3 && (
            <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t("moreCount", { count: overdue.length - 3 })}</p>
          )}
        </div>
      )}
    </Link>
  );
}
