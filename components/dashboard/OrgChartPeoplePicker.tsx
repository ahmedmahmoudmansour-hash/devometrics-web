"use client";

import { useMemo, useState } from "react";
import { memberTag, positionTag } from "@/lib/orgChart/mergedTree";
import type { WorkforceRow } from "@/lib/organizations/aggregate";
import type { OrgPositionRow } from "@/lib/orgChart/positions";

type Candidate = { tag: string; label: string; subtitle: string };

// The "build a chart from scratch" picker — search + checklist over every
// real person and position in the org, checked state bound directly to
// OrgChartFilters.includedIds. Deliberately a flat, searchable list rather
// than anything tree-shaped: picking is about "which specific people,"
// unrelated to who currently reports to whom (that's recomputed live from
// real data once picked — see OrgChartView.tsx's visibleIds).
export default function OrgChartPeoplePicker({
  rows,
  positions,
  includedIds,
  onToggle,
  onClose,
  title,
  searchPlaceholder,
  countLabel,
  emptyLabel,
  vacantLabel,
  structuralLabel,
  doneLabel,
}: {
  rows: WorkforceRow[];
  positions: OrgPositionRow[];
  includedIds: string[];
  onToggle: (taggedId: string) => void;
  onClose: () => void;
  title: string;
  searchPlaceholder: string;
  countLabel: string;
  emptyLabel: string;
  vacantLabel: string;
  structuralLabel: string;
  doneLabel: string;
}) {
  const [query, setQuery] = useState("");
  const includedSet = useMemo(() => new Set(includedIds), [includedIds]);

  const candidates = useMemo<Candidate[]>(() => {
    const people: Candidate[] = rows.map((r) => ({ tag: memberTag(r.userId), label: r.name, subtitle: r.title ?? "" }));
    const posEntries: Candidate[] = positions.map((p) => ({
      tag: positionTag(p.id),
      label: p.title,
      subtitle: p.kind === "vacant_role" ? vacantLabel : structuralLabel,
    }));
    const all = [...people, ...posEntries];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((c) => c.label.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q));
  }, [rows, positions, query, vacantLabel, structuralLabel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(3,8,16,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, maxWidth: 460, width: "100%", maxHeight: "80vh", display: "flex", flexDirection: "column" }}
      >
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>{title}</p>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--text)", outline: "none", marginBottom: 10 }}
        />
        <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {candidates.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", padding: 6 }}>{emptyLabel}</p>
          ) : (
            candidates.map((c) => (
              <label
                key={c.tag}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 6px", borderRadius: 8, cursor: "pointer" }}
              >
                <input type="checkbox" checked={includedSet.has(c.tag)} onChange={() => onToggle(c.tag)} />
                <span style={{ fontSize: 13, color: "var(--text)" }}>{c.label}</span>
                {c.subtitle && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>— {c.subtitle}</span>}
              </label>
            ))
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{countLabel}</span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
          >
            {doneLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
