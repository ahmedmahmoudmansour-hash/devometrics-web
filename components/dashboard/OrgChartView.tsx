"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMemberManager } from "@/lib/orgChart/actions";
import { buildReportingForest, type OrgChartNode } from "@/lib/orgChart/tree";
import type { WorkforceRow } from "@/lib/organizations/aggregate";

const CARD_W = 168;
const CARD_H = 60;
const UNIT_W = CARD_W + 32; // horizontal spacing between leaf slots
const LEVEL_H = 110; // vertical spacing between reporting levels
const PAD = 40;

type LayoutNode = {
  node: OrgChartNode;
  x: number; // px, center
  y: number; // px, top
  children: LayoutNode[];
};

function subtreeWidth(node: OrgChartNode): number {
  if (node.children.length === 0) return 1;
  return node.children.reduce((sum, c) => sum + subtreeWidth(c), 0);
}

// Classic tidy-tree layout: each leaf gets one horizontal "slot," an
// internal node's width is the sum of its children's widths, and the
// parent centers itself above its children. Hand-rolled rather than a
// library, same posture as every other chart in this app (charts.tsx) —
// this is genuinely more complex than a bar/donut chart, but the algorithm
// itself is a well-known, small one, not worth a dependency for.
function layout(node: OrgChartNode, depth: number, xOffsetUnits: number): LayoutNode {
  const width = subtreeWidth(node);
  if (node.children.length === 0) {
    return { node, x: (xOffsetUnits + width / 2) * UNIT_W, y: depth * LEVEL_H, children: [] };
  }
  let cursor = xOffsetUnits;
  const children: LayoutNode[] = [];
  for (const child of node.children) {
    const childWidth = subtreeWidth(child);
    children.push(layout(child, depth + 1, cursor));
    cursor += childWidth;
  }
  const x = (children[0].x + children[children.length - 1].x) / 2;
  return { node, x, y: depth * LEVEL_H, children };
}

function flatten(layoutNode: LayoutNode, out: LayoutNode[] = []): LayoutNode[] {
  out.push(layoutNode);
  for (const c of layoutNode.children) flatten(c, out);
  return out;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function OrgChartView({ rows }: { rows: WorkforceRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const forest = useMemo(() => buildReportingForest(rows), [rows]);

  const laidOutRoots = useMemo(() => {
    // Purely functional accumulation (reduce, not a mutated loop variable) —
    // each root's tree is laid out at the running cursor position, then the
    // cursor advances by that tree's width plus a gap, threaded through the
    // accumulator rather than reassigned, so separate reporting trees never
    // overlap horizontally.
    return forest.reduce<{ laidOut: LayoutNode[]; cursor: number }>(
      (acc, root) => ({
        laidOut: [...acc.laidOut, layout(root, 0, acc.cursor)],
        cursor: acc.cursor + subtreeWidth(root) + 0.6,
      }),
      { laidOut: [], cursor: 0 }
    ).laidOut;
  }, [forest]);

  const allNodes = useMemo(() => laidOutRoots.flatMap((r) => flatten(r)), [laidOutRoots]);
  const maxX = Math.max(CARD_W, ...allNodes.map((n) => n.x)) + CARD_W;
  const maxY = Math.max(0, ...allNodes.map((n) => n.y)) + CARD_H;

  const selectedRow = selectedUserId ? rows.find((r) => r.userId === selectedUserId) ?? null : null;

  return (
    <div>
      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 16, background: "var(--navy-mid)" }}>
        <svg width={maxX + PAD * 2} height={maxY + PAD * 2} style={{ display: "block" }}>
          <g transform={`translate(${PAD}, ${PAD})`}>
            {/* connectors: vertical from parent bottom to a mid-level bus, horizontal bus spanning children, vertical bus-to-child */}
            {allNodes.map((n) =>
              n.children.length > 0 ? (
                <g key={`edges-${n.node.row.userId}`} stroke="var(--border)" strokeWidth={1.5} fill="none">
                  {(() => {
                    const busY = n.y + CARD_H + (LEVEL_H - CARD_H) / 2;
                    const firstX = n.children[0].x;
                    const lastX = n.children[n.children.length - 1].x;
                    return (
                      <>
                        <line x1={n.x} y1={n.y + CARD_H} x2={n.x} y2={busY} />
                        {n.children.length > 1 && <line x1={firstX} y1={busY} x2={lastX} y2={busY} />}
                        {n.children.map((c) => (
                          <line key={c.node.row.userId} x1={c.x} y1={busY} x2={c.x} y2={c.y} />
                        ))}
                      </>
                    );
                  })()}
                </g>
              ) : null
            )}

            {allNodes.map((n) => {
              const row = n.node.row;
              const selected = row.userId === selectedUserId;
              return (
                <g
                  key={row.userId}
                  transform={`translate(${n.x - CARD_W / 2}, ${n.y})`}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setSelectedUserId(row.userId);
                    setError(null);
                  }}
                >
                  <rect
                    width={CARD_W}
                    height={CARD_H}
                    rx={10}
                    fill="var(--navy)"
                    stroke={selected ? "var(--teal)" : "var(--border)"}
                    strokeWidth={selected ? 2 : 1}
                  />
                  <circle cx={26} cy={CARD_H / 2} r={14} fill="rgba(0,201,167,0.12)" stroke="rgba(0,201,167,0.3)" />
                  <text x={26} y={CARD_H / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--teal)">
                    {initials(row.name)}
                  </text>
                  <text x={48} y={CARD_H / 2 - 4} fontSize={12.5} fontWeight={700} fill="var(--text)">
                    {row.name.length > 18 ? row.name.slice(0, 17) + "…" : row.name}
                  </text>
                  <text x={48} y={CARD_H / 2 + 13} fontSize={10.5} fill="var(--text-muted)">
                    {(row.title ?? "No title").length > 20 ? (row.title ?? "No title").slice(0, 19) + "…" : row.title ?? "No title"}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {laidOutRoots.length > 1 && (
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.5 }}>
          {laidOutRoots.length} separate reporting trees — anyone without a manager assigned starts a new
          one. Click a person below to give them a manager and connect the trees.
        </p>
      )}

      {selectedRow && (
        <div style={{ marginTop: 16, background: "var(--navy-mid)", border: "1px solid rgba(0,201,167,0.3)", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{selectedRow.name}</span>
            <button
              type="button"
              onClick={() => setSelectedUserId(null)}
              style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}
            >
              Close
            </button>
          </div>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Reports to</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select
              disabled={isPending}
              defaultValue={selectedRow.managerUserId ?? ""}
              onChange={(e) => {
                const newManagerId = e.target.value || null;
                setError(null);
                startTransition(async () => {
                  const result = await setMemberManager(selectedRow.userId, newManagerId);
                  if (result?.error) setError(result.error);
                  else router.refresh();
                });
              }}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 13,
                color: "var(--text)",
                outline: "none",
                cursor: "pointer",
                minWidth: 220,
              }}
            >
              <option value="">— No manager (top of a reporting line) —</option>
              {rows
                .filter((r) => r.userId !== selectedRow.userId)
                .map((r) => (
                  <option key={r.userId} value={r.userId}>
                    {r.name}
                    {r.title ? ` — ${r.title}` : ""}
                  </option>
                ))}
            </select>
            {isPending && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Saving…</span>}
          </div>
          {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>{error}</p>}
        </div>
      )}
    </div>
  );
}
