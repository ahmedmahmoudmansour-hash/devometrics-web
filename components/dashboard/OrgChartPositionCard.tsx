"use client";

import { useTranslations } from "next-intl";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CARD_H, CARD_W } from "@/lib/orgChart/tree";
import type { OrgChartCardToggles, CardDensity } from "@/lib/orgChart/cardConfig";
import type { OrgPositionRow } from "@/lib/orgChart/positions";
import type { DropState } from "@/components/dashboard/OrgChartCard";

const COMPACT_CARD_H = 44;

// Color-coding by kind/status so a large chart reads instantly, per
// Ahmed's explicit ask. Scoped to position cards only — real employee
// cards (OrgChartCard.tsx) are unaffected. Structural nodes always read as
// "structural" regardless of their (always-'open') status.
const KIND_STATUS_COLORS: Record<string, { fg: string; bg: string; border: string }> = {
  structural: { fg: "#60a5fa", bg: "rgba(96,165,250,0.1)", border: "rgba(96,165,250,0.35)" },
  open: { fg: "var(--amber)", bg: "rgba(var(--amber-rgb),0.1)", border: "rgba(var(--amber-rgb),0.35)" },
  future: { fg: "#a78bfa", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.35)" },
  frozen: { fg: "#9ca3af", bg: "rgba(156,163,175,0.1)", border: "rgba(156,163,175,0.35)" },
};

function ellipsize(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

export default function OrgChartPositionCard({
  position,
  toggles,
  density,
  hasHiddenChildren,
  isSelected,
  dropState,
  onSelect,
  onExpandBranch,
}: {
  position: OrgPositionRow;
  toggles: OrgChartCardToggles;
  density: CardDensity;
  hasHiddenChildren: boolean;
  isSelected: boolean;
  dropState: DropState;
  onSelect: (id: string) => void;
  onExpandBranch: (id: string) => void;
}) {
  const t = useTranslations("orgChartPositionCard");
  const tag = `position:${position.id}`;
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `drag-${tag}`,
    data: { taggedId: tag },
  });
  const { setNodeRef: setDropRef } = useDroppable({
    id: `drop-${tag}`,
    data: { taggedId: tag },
  });

  const height = density === "compact" ? COMPACT_CARD_H : CARD_H;
  const colorKey = position.kind === "structural" ? "structural" : position.status;
  const colors = KIND_STATUS_COLORS[colorKey] ?? KIND_STATUS_COLORS.open;

  const ringColor = dropState === "valid" ? "var(--teal)" : dropState === "invalid" || dropState === "self" ? "var(--danger)" : isSelected ? "var(--teal)" : colors.border;
  const ringWidth = dropState === "valid" || dropState === "invalid" || isSelected ? 2 : 1;

  return (
    <div
      ref={(el) => {
        setDragRef(el);
        setDropRef(el);
      }}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(position.id)}
      style={{
        width: CARD_W,
        minHeight: height,
        background: colors.bg,
        border: `${ringWidth}px dashed ${ringColor}`,
        borderRadius: 10,
        padding: density === "compact" ? "6px 8px" : "8px 10px",
        cursor: "grab",
        opacity: isDragging ? 0.35 : 1,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        position: "relative",
        boxShadow: dropState === "valid" ? "0 0 0 3px rgba(var(--teal-rgb),0.25)" : dropState === "invalid" || dropState === "self" ? "0 0 0 3px rgba(var(--danger-rgb),0.2)" : "none",
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 700, color: colors.fg, textTransform: "uppercase", letterSpacing: "0.03em" }}>
        {position.kind === "structural" ? t("kindStructural") : t(`status_${position.status}`)}
      </span>

      <p style={{ fontSize: density === "compact" ? 11.5 : 12.5, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {position.title}
      </p>

      {toggles.showDepartment && position.department && (
        <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{position.department}</p>
      )}
      {toggles.showLocation && position.location && (
        <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{position.location}</p>
      )}
      {position.headcount !== null && (
        <p style={{ fontSize: 10, fontWeight: 700, color: colors.fg }}>{t("headcountCount", { count: position.headcount })}</p>
      )}

      {toggles.showPositionLinks && (position.linkedPostingTitle || position.linkedRoleTitle) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 2 }}>
          {position.linkedPostingTitle && (
            <p style={{ fontSize: 9.5, color: "var(--text-muted)" }}>
              {t("linkedPosting", { title: ellipsize(position.linkedPostingTitle, 20) })}
              {position.linkedPostingStatus ? ` · ${t(`postingStatus_${position.linkedPostingStatus}`)}` : ""}
            </p>
          )}
          {position.linkedRoleTitle && (
            <p style={{ fontSize: 9.5, color: "var(--text-muted)" }}>
              {t("linkedRole", { title: ellipsize(position.linkedRoleTitle, 20) })}
              {position.linkedRoleGrade !== null ? ` · G${position.linkedRoleGrade}` : ""}
            </p>
          )}
        </div>
      )}

      {position.kind === "vacant_role" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(position.id);
          }}
          style={{
            alignSelf: "flex-start",
            marginTop: 3,
            background: "none",
            border: "none",
            padding: 0,
            fontSize: 9.5,
            fontWeight: 700,
            color: "var(--teal)",
            cursor: "pointer",
          }}
        >
          {t("fillPosition")}
        </button>
      )}

      {hasHiddenChildren && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onExpandBranch(position.id);
          }}
          style={{
            position: "absolute",
            bottom: -10,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--navy)",
            border: "1px solid var(--teal)",
            color: "var(--teal)",
            borderRadius: 999,
            fontSize: 9.5,
            fontWeight: 700,
            padding: "1px 8px",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {t("expandBranch")}
        </button>
      )}
    </div>
  );
}
