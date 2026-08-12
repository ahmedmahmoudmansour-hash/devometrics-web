import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ListChecks, ClipboardList, Library, ClipboardCheck, Milestone as MilestoneIcon } from "lucide-react";
import type { PendingAction, PendingActionType } from "@/lib/actionHub/types";

const TYPE_ICON: Record<PendingActionType, React.ComponentType<{ size?: number }>> = {
  task: ListChecks,
  assessment: ClipboardList,
  knowledge_hub: Library,
  performance_review: ClipboardCheck,
  milestone: MilestoneIcon,
};

// The single consolidated "everything requiring your attention" list —
// tasks, assigned assessments, Knowledge Hub training, and an open
// performance review self-assessment, previously four separate surfaces
// a person had to check individually. See lib/actionHub/actions.ts for
// why this is unfiltered by due-date proximity (unlike the reminder
// emails): this is a persistent to-do list, not a nag.
export default async function PendingActionsPanel({ actions, compact = false }: { actions: PendingAction[]; compact?: boolean }) {
  const t = await getTranslations("pendingActionsPanel");
  if (actions.length === 0) return null;

  const sorted = [...actions].sort((a, b) => (a.overdue === b.overdue ? 0 : a.overdue ? -1 : 1));
  const shown = compact ? sorted.slice(0, 5) : sorted;
  const overdueCount = actions.filter((a) => a.overdue).length;

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 22 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{t("title")}</p>
        <span style={{ fontSize: 12, color: overdueCount > 0 ? "var(--amber)" : "var(--text-muted)", fontWeight: 700 }}>
          {t("count", { count: actions.length })}
        </span>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>{t("hint")}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.map((action) => {
          const Icon = TYPE_ICON[action.type];
          return (
            <Link
              key={action.id}
              href={action.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 12px",
                borderRadius: 10,
                textDecoration: "none",
                border: "1px solid var(--border)",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <Icon size={15} />
              <span style={{ flex: 1, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {action.title}
              </span>
              {action.subtitle && (
                <span style={{ fontSize: 11.5, color: "var(--text-muted)", flexShrink: 0 }}>{action.subtitle}</span>
              )}
              {action.overdue && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--amber)",
                    background: "rgba(240,184,64,0.1)",
                    border: "1px solid rgba(240,184,64,0.3)",
                    borderRadius: 999,
                    padding: "2px 8px",
                    flexShrink: 0,
                  }}
                >
                  {t("overdue")}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {compact && actions.length > shown.length && (
        <Link href="/dashboard/tasks" style={{ display: "inline-block", marginTop: 12, fontSize: 12.5, fontWeight: 700, color: "var(--teal)", textDecoration: "none" }}>
          {t("seeAll", { count: actions.length })}
        </Link>
      )}
    </div>
  );
}
