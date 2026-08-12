"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import MilestoneRow from "./MilestoneRow";
import AddMilestoneForm from "./AddMilestoneForm";
import { updatePlanTitle, deletePlan } from "@/app/dashboard/actions";
import type { DevelopmentPlan, Milestone } from "@/lib/supabase/types";

export default function PlanCard({
  plan,
  milestones,
  showDetailLink = true,
}: {
  plan: DevelopmentPlan;
  milestones: Milestone[];
  // The detail page (/dashboard/plans/[id]) now embeds this same component
  // for interactive editing — a "View & export" link back to the page
  // you're already on is redundant there, so it's suppressed by the
  // detail page passing false.
  showDetailLink?: boolean;
}) {
  const t = useTranslations("planCard");
  const [isPending, startTransition] = useTransition();
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(plan.title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = milestones.length;
  const done = milestones.filter((m) => m.completed).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div
      style={{
        background: "var(--navy-mid)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 28,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          {editingTitle ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-label={t("planTitleAria")}
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--text)",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6,
                  padding: "6px 10px",
                  outline: "none",
                }}
              />
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await updatePlanTitle(plan.id, title);
                    if (result?.error) setError(result.error);
                    else setEditingTitle(false);
                  })
                }
                style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                {t("save")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTitle(plan.title);
                  setEditingTitle(false);
                }}
                style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 12px", fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}
              >
                {t("cancel")}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{plan.title}</h2>
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                aria-label={t("editPlanTitleAria")}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}
              >
                {t("edit")}
              </button>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {plan.horizon && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--teal)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                background: "rgba(var(--teal-rgb),0.1)",
                border: "1px solid rgba(var(--teal-rgb),0.3)",
                borderRadius: 100,
                padding: "4px 12px",
                whiteSpace: "nowrap",
              }}
            >
              {plan.horizon}
            </span>
          )}
          <span style={{ fontSize: 13, color: "var(--teal)", fontWeight: 600 }}>
            {t("completeCount", { done, total })}
          </span>
          {showDetailLink && (
            <Link
              href={`/dashboard/plans/${plan.id}`}
              style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "underline" }}
            >
              {t("viewAndExport")}
            </Link>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          height: 6,
          borderRadius: 3,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "var(--teal)",
            transition: "width 0.3s ease",
          }}
        />
      </div>

      <div style={{ marginTop: 20 }}>
        {milestones.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            {t("noMilestonesYet")}
          </p>
        ) : (
          milestones
            .sort((a, b) => a.position - b.position)
            .map((m) => <MilestoneRow key={m.id} milestone={m} />)
        )}
      </div>

      <AddMilestoneForm planId={plan.id} nextPosition={milestones.length} />

      <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        {error && <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 8 }}>{error}</p>}
        {confirmingDelete ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("confirmDeleteQuestion")}</span>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deletePlan(plan.id);
                  if (result?.error) setError(result.error);
                })
              }
              style={{ background: "rgba(var(--danger-rgb),0.12)", border: "1px solid rgba(var(--danger-rgb),0.4)", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 700, color: "var(--danger)", cursor: "pointer" }}
            >
              {t("confirmDelete")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 14px", fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}
            >
              {t("cancel")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}
          >
            {t("deletePlan")}
          </button>
        )}
      </div>
    </div>
  );
}
