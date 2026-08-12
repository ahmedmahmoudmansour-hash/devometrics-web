"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { assignCustomStepResponder, unassignCustomStepResponder } from "@/lib/performanceReviews/actions";

// Manual-mode assignment surface: the employee's manager or an org admin
// picks specific org members (peers, a named executive, a country lead) for
// a custom step — role-mode steps never show this, they're resolved
// automatically at instantiation (resolve_custom_step_role_assignments).
// "Nobody assigned yet" is a normal state here, not an error.
export default function CustomStepAssigneePicker({
  instanceStepId,
  options,
  currentAssignees,
  multiRespondent,
  onChanged,
}: {
  instanceStepId: string;
  options: { userId: string; name: string; email: string }[];
  currentAssignees: { assigneeUserId: string; assigneeName: string }[];
  multiRespondent: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations("customStepAssigneePicker");
  const [selected, setSelected] = useState("");
  const [isPending, startTransition] = useTransition();

  const assignedIds = new Set(currentAssignees.map((a) => a.assigneeUserId));
  const available = options.filter((o) => !assignedIds.has(o.userId));
  const canAssignMore = multiRespondent || currentAssignees.length === 0;

  function assign() {
    if (!selected) return;
    startTransition(async () => {
      await assignCustomStepResponder(instanceStepId, selected);
      setSelected("");
      onChanged();
    });
  }

  function unassign(userId: string) {
    startTransition(async () => {
      await unassignCustomStepResponder(instanceStepId, userId);
      onChanged();
    });
  }

  return (
    <div style={{ marginTop: 8 }}>
      {currentAssignees.length === 0 ? (
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 6 }}>{t("noneAssignedYet")}</p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {currentAssignees.map((a) => (
            <span
              key={a.assigneeUserId}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--border)",
                borderRadius: 999,
                padding: "3px 6px 3px 10px",
                fontSize: 11.5,
                color: "var(--text)",
              }}
            >
              {a.assigneeName}
              <button
                type="button"
                onClick={() => unassign(a.assigneeUserId)}
                disabled={isPending}
                aria-label={t("remove", { name: a.assigneeName })}
                style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 11, padding: 0 }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      {canAssignMore && available.length > 0 && (
        <div style={{ display: "flex", gap: 6 }}>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", fontSize: 11.5, color: "var(--text)", flex: 1, cursor: "pointer" }}
          >
            <option value="">{t("pickSomeone")}</option>
            {available.map((o) => (
              <option key={o.userId} value={o.userId}>
                {o.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={assign}
            disabled={!selected || isPending}
            style={{ background: "rgba(var(--teal-rgb),0.1)", border: "1px solid rgba(var(--teal-rgb),0.3)", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "var(--teal)", cursor: "pointer", opacity: !selected || isPending ? 0.6 : 1 }}
          >
            {t("assign")}
          </button>
        </div>
      )}
    </div>
  );
}
