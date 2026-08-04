"use client";

import { useTranslations } from "next-intl";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CARD_H, CARD_W } from "@/lib/orgChart/tree";
import type { OrgChartCardToggles, CardDensity } from "@/lib/orgChart/cardConfig";
import type { WorkforceRow } from "@/lib/organizations/aggregate";

const COMPACT_CARD_H = 44;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ellipsize(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

function formatMemberSince(t: (key: string, values?: Record<string, string | number>) => string, iso: string | null): string | null {
  if (!iso) return null;
  const joined = new Date(iso);
  const months = Math.max(0, Math.floor((Date.now() - joined.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (years === 0) return t("tenureMonths", { months: remMonths });
  if (remMonths === 0) return t("tenureYears", { years });
  return t("tenureYearsMonths", { years, months: remMonths });
}

export type DropState = "none" | "valid" | "invalid" | "self";

export default function OrgChartCard({
  row,
  toggles,
  density,
  hasHiddenChildren,
  isSuccessionCandidate,
  isSelected,
  dropState,
  onSelect,
  onExpandBranch,
}: {
  row: WorkforceRow;
  toggles: OrgChartCardToggles;
  density: CardDensity;
  hasHiddenChildren: boolean;
  isSuccessionCandidate: boolean;
  isSelected: boolean;
  dropState: DropState;
  onSelect: (userId: string) => void;
  onExpandBranch: (userId: string) => void;
}) {
  const t = useTranslations("orgChartView");
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `drag-${row.userId}`,
    data: { userId: row.userId },
  });
  const { setNodeRef: setDropRef } = useDroppable({
    id: `drop-${row.userId}`,
    data: { userId: row.userId },
  });

  const height = density === "compact" ? COMPACT_CARD_H : CARD_H;
  const memberSince = toggles.showTenure ? formatMemberSince(t, row.memberSince) : null;

  const ringColor = dropState === "valid" ? "var(--teal)" : dropState === "invalid" || dropState === "self" ? "#f87171" : isSelected ? "var(--teal)" : "var(--border)";
  const ringWidth = dropState === "valid" || dropState === "invalid" || isSelected ? 2 : 1;

  return (
    <div
      ref={(el) => {
        setDragRef(el);
        setDropRef(el);
      }}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(row.userId)}
      style={{
        width: CARD_W,
        minHeight: height,
        background: "var(--navy)",
        border: `${ringWidth}px solid ${ringColor}`,
        borderRadius: 10,
        padding: density === "compact" ? "6px 8px" : "8px 10px",
        cursor: "grab",
        opacity: isDragging ? 0.35 : 1,
        display: "flex",
        alignItems: "center",
        gap: 8,
        position: "relative",
        boxShadow: dropState === "valid" ? "0 0 0 3px rgba(0,201,167,0.25)" : dropState === "invalid" || dropState === "self" ? "0 0 0 3px rgba(248,113,113,0.2)" : "none",
      }}
    >
      {toggles.showPhoto && (
        <div style={{ flexShrink: 0, width: density === "compact" ? 22 : 28, height: density === "compact" ? 22 : 28, borderRadius: "50%", overflow: "hidden", background: "rgba(0,201,167,0.12)", border: "1px solid rgba(0,201,167,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {row.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <span style={{ fontSize: density === "compact" ? 9.5 : 11, fontWeight: 700, color: "var(--teal)" }}>{initials(row.name)}</span>
          )}
        </div>
      )}

      <div style={{ minWidth: 0, flex: 1 }}>
        {toggles.showName && (
          <p style={{ fontSize: density === "compact" ? 11.5 : 12.5, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {row.name}
          </p>
        )}
        {toggles.showTitle && (
          <p style={{ fontSize: density === "compact" ? 10 : 10.5, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {ellipsize(row.title ?? t("noTitle"), 22)}
          </p>
        )}
        {toggles.showDepartment && row.department && (
          <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{row.department}</p>
        )}
        {toggles.showLocation && row.location && (
          <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{row.location}</p>
        )}
        {memberSince && <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{memberSince}</p>}

        {(toggles.showPerformanceBadge || toggles.showSuccessionStatus) && (
          <div style={{ display: "flex", gap: 4, marginTop: 3, flexWrap: "wrap" }}>
            {toggles.showPerformanceBadge && row.performanceRating !== null && (
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--teal)", background: "rgba(0,201,167,0.1)", border: "1px solid rgba(0,201,167,0.3)", borderRadius: 999, padding: "1px 6px" }}>
                {t("performanceBadge", { rating: row.performanceRating })}
              </span>
            )}
            {toggles.showSuccessionStatus && isSuccessionCandidate && (
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "#a78bfa", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 999, padding: "1px 6px" }}>
                {t("successionBadge")}
              </span>
            )}
          </div>
        )}
      </div>

      {hasHiddenChildren && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onExpandBranch(row.userId);
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
