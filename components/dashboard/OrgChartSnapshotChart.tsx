"use client";

import { useMemo } from "react";
import { layout, flatten, subtreeWidth, CARD_W, CARD_H, LEVEL_H, type LayoutNode } from "@/lib/orgChart/tree";
import type { OrgChartSnapshotTreeNode } from "@/lib/orgChart/snapshots";

const PAD = 24;

// Read-only visual chart for a snapshot's point-in-time structure — runs
// the exact same tidy-tree layout math the live chart uses (lib/orgChart/
// tree.ts's layout/flatten/subtreeWidth are generic over any {children:T[]}
// node, so a snapshot's much lighter node shape works unchanged), just
// rendered as plain boxes with no drag/select/edit affordances, since a
// snapshot is a frozen record, not something you reshape from here.
export default function OrgChartSnapshotChart({
  roots,
  vacantLabel,
  structuralLabel,
}: {
  roots: OrgChartSnapshotTreeNode[];
  vacantLabel: string;
  structuralLabel: string;
}) {
  const laidOutRoots = useMemo(() => {
    return roots.reduce<{ laidOut: LayoutNode<OrgChartSnapshotTreeNode>[]; cursor: number }>(
      (acc, root) => ({
        laidOut: [...acc.laidOut, layout(root, 0, acc.cursor)],
        cursor: acc.cursor + subtreeWidth(root) + 0.6,
      }),
      { laidOut: [], cursor: 0 }
    ).laidOut;
  }, [roots]);

  const allNodes = useMemo(() => laidOutRoots.flatMap((r) => flatten(r)), [laidOutRoots]);
  const maxX = Math.max(CARD_W, ...allNodes.map((n) => n.x)) + CARD_W;
  const maxY = Math.max(0, ...allNodes.map((n) => n.y)) + CARD_H;

  if (allNodes.length === 0) return null;

  return (
    <div style={{ overflow: "auto", maxHeight: "60vh" }}>
      <div style={{ position: "relative", width: maxX + PAD * 2, height: maxY + PAD * 2 }}>
        <svg width={maxX + PAD * 2} height={maxY + PAD * 2} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <g transform={`translate(${PAD}, ${PAD})`}>
            {allNodes.map((n) =>
              n.children.length > 0 ? (
                <g key={`edges-${n.node.id}`} stroke="var(--border)" strokeWidth={1.5} fill="none">
                  {(() => {
                    const busY = n.y + CARD_H + (LEVEL_H - CARD_H) / 2;
                    const firstX = n.children[0].x;
                    const lastX = n.children[n.children.length - 1].x;
                    return (
                      <>
                        <line x1={n.x} y1={n.y + CARD_H} x2={n.x} y2={busY} />
                        {n.children.length > 1 && <line x1={firstX} y1={busY} x2={lastX} y2={busY} />}
                        {n.children.map((c) => (
                          <line key={c.node.id} x1={c.x} y1={busY} x2={c.x} y2={c.y} />
                        ))}
                      </>
                    );
                  })()}
                </g>
              ) : null
            )}
          </g>
        </svg>

        <div style={{ position: "absolute", left: PAD, top: PAD }}>
          {allNodes.map((n) => {
            const isPosition = n.node.kind === "position";
            return (
              <div
                key={n.node.id}
                style={{
                  position: "absolute",
                  left: n.x - CARD_W / 2,
                  top: n.y,
                  width: CARD_W,
                  minHeight: CARD_H,
                  background: isPosition ? "rgba(240,184,64,0.08)" : "var(--navy)",
                  border: isPosition ? "1px dashed rgba(240,184,64,0.4)" : "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "8px 10px",
                  boxSizing: "border-box",
                }}
              >
                {isPosition && (
                  <span style={{ display: "block", fontSize: 9.5, fontWeight: 700, color: "var(--amber)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
                    {n.node.positionKind === "vacant_role" ? vacantLabel : structuralLabel}
                  </span>
                )}
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>{n.node.label}</span>
                {n.node.subtitle && (
                  <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{n.node.subtitle}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
