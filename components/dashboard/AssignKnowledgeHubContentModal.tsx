"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { assignKnowledgeHubContent } from "@/lib/knowledgeHub/actions";

type Employee = { userId: string; name: string; email: string };

export default function AssignKnowledgeHubContentModal({
  contentId,
  employees,
  alreadyAssignedUserIds,
}: {
  contentId: string;
  employees: Employee[];
  alreadyAssignedUserIds: string[];
}) {
  const t = useTranslations("assignKnowledgeHubContentModal");
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const assignedSet = new Set(alreadyAssignedUserIds);
  const assignable = employees.filter((e) => !assignedSet.has(e.userId));
  const allSelected = assignable.length > 0 && selected.length === assignable.length;

  function toggle(userId: string) {
    setSelected((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  function toggleAll() {
    setSelected(allSelected ? [] : assignable.map((e) => e.userId));
  }

  function handleAssign() {
    if (selected.length === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await assignKnowledgeHubContent(contentId, selected);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSelected([]);
      setExpanded(false);
      router.refresh();
    });
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        disabled={assignable.length === 0}
        style={{
          background: "var(--teal)",
          color: "#0A0F1E",
          border: "none",
          borderRadius: 8,
          padding: "10px 18px",
          fontSize: 14,
          fontWeight: 700,
          cursor: assignable.length === 0 ? "not-allowed" : "pointer",
          opacity: assignable.length === 0 ? 0.5 : 1,
        }}
      >
        {assignable.length === 0 ? t("everyoneAssigned") : t("assignToEmployees")}
      </button>
    );
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
          {t("assignToEmployeesCount", { count: selected.length })}
        </p>
        <button
          type="button"
          onClick={toggleAll}
          style={{ background: "none", border: "none", color: "var(--teal)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          {allSelected ? t("deselectAll") : t("selectAll")}
        </button>
      </div>

      <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
        {assignable.map((e) => (
          <label
            key={e.userId}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", fontSize: 13, color: "var(--text)", cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={selected.includes(e.userId)}
              onChange={() => toggle(e.userId)}
              style={{ accentColor: "var(--teal)" }}
            />
            <span>{e.name}</span>
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{e.email}</span>
          </label>
        ))}
      </div>

      {error && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <div style={{ display: "flex", gap: 12 }}>
        <button
          type="button"
          onClick={handleAssign}
          disabled={selected.length === 0 || isPending}
          style={{
            background: "var(--teal)",
            color: "#0A0F1E",
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 700,
            cursor: selected.length === 0 ? "not-allowed" : "pointer",
            opacity: selected.length === 0 || isPending ? 0.6 : 1,
          }}
        >
          {isPending ? t("assigning") : t("assignToCount", { count: selected.length || "" })}
        </button>
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setSelected([]);
          }}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
