// Pure reporting-line tree logic — no rendering here, just the graph math,
// so it's testable independent of SVG layout and reusable if a second view
// ever needs it.
import type { WorkforceRow } from "@/lib/organizations/aggregate";

export type OrgChartNode = {
  row: WorkforceRow;
  children: OrgChartNode[];
};

// Builds the reporting-line forest. Roots are people with no manager set,
// OR whose manager isn't an active member of this org roster (left the
// company, archived, or the reference is simply stale) — those are
// deliberately treated as unassigned roots rather than silently dropped,
// so nobody ever disappears from the chart.
export function buildReportingForest(rows: WorkforceRow[]): OrgChartNode[] {
  const byUserId = new Map(rows.map((r) => [r.userId, r]));
  const childrenByManager = new Map<string, WorkforceRow[]>();
  const roots: WorkforceRow[] = [];

  for (const row of rows) {
    const managerId = row.managerUserId;
    if (managerId && managerId !== row.userId && byUserId.has(managerId)) {
      const list = childrenByManager.get(managerId) ?? [];
      list.push(row);
      childrenByManager.set(managerId, list);
    } else {
      roots.push(row);
    }
  }

  // visited-set cycle guard: app-level writes (setMemberManager) already
  // reject anything that would create a cycle, but this defends the
  // RENDER path too — a stale/hand-edited row should degrade to "stop
  // descending here," never hang the page in infinite recursion.
  function buildNode(row: WorkforceRow, visited: Set<string>): OrgChartNode {
    if (visited.has(row.userId)) return { row, children: [] };
    const nextVisited = new Set(visited).add(row.userId);
    const children = (childrenByManager.get(row.userId) ?? []).map((c) => buildNode(c, nextVisited));
    return { row, children };
  }

  return roots
    .map((r) => buildNode(r, new Set()))
    .sort((a, b) => a.row.name.localeCompare(b.row.name));
}

// Walks up the reporting chain from candidateManagerId; if it ever reaches
// targetUserId, making candidateManagerId the manager of targetUserId
// would create a cycle (targetUserId would end up managing their own
// manager, directly or indirectly). Called before every write.
export function wouldCreateCycle(
  targetUserId: string,
  candidateManagerId: string,
  managerByUserId: Map<string, string | null>
): boolean {
  let current: string | null = candidateManagerId;
  const seen = new Set<string>();
  while (current) {
    if (current === targetUserId) return true;
    if (seen.has(current)) return false; // pre-existing corrupt chain elsewhere — not this write's fault, don't block it
    seen.add(current);
    current = managerByUserId.get(current) ?? null;
  }
  return false;
}

// ---------- Layout math (Workstream 6) ----------
//
// Moved in from OrgChartView.tsx unchanged — this was always pure position
// math with zero SVG/DOM references, it just had nowhere else to live until
// a second rendering target (HTML/CSS cards) needed the exact same numbers.

export const CARD_W = 168;
export const CARD_H = 60;
export const UNIT_W = CARD_W + 32; // horizontal spacing between leaf slots
export const LEVEL_H = 110; // vertical spacing between reporting levels

// Generic over any {children: T[]}-shaped node — works unchanged for both
// OrgChartNode (today) and DisplayNode (post depth-cap, see below), so the
// same positioning math serves the tree both before and after capping
// without duplicating it.
export type LayoutNode<T extends { children: T[] }> = {
  node: T;
  x: number; // px, center
  y: number; // px, top
  children: LayoutNode<T>[];
};

export function subtreeWidth<T extends { children: T[] }>(node: T): number {
  if (node.children.length === 0) return 1;
  return node.children.reduce((sum, c) => sum + subtreeWidth(c), 0);
}

// Classic tidy-tree layout: each leaf gets one horizontal "slot," an
// internal node's width is the sum of its children's widths, and the
// parent centers itself above its children. Hand-rolled rather than a
// library, same posture as every other chart in this app (charts.tsx) —
// this is genuinely more complex than a bar/donut chart, but the algorithm
// itself is a well-known, small one, not worth a dependency for.
export function layout<T extends { children: T[] }>(node: T, depth: number, xOffsetUnits: number): LayoutNode<T> {
  const width = subtreeWidth(node);
  if (node.children.length === 0) {
    return { node, x: (xOffsetUnits + width / 2) * UNIT_W, y: depth * LEVEL_H, children: [] };
  }
  let cursor = xOffsetUnits;
  const children: LayoutNode<T>[] = [];
  for (const child of node.children) {
    const childWidth = subtreeWidth(child);
    children.push(layout(child, depth + 1, cursor));
    cursor += childWidth;
  }
  const x = (children[0].x + children[children.length - 1].x) / 2;
  return { node, x, y: depth * LEVEL_H, children };
}

export function flatten<T extends { children: T[] }>(layoutNode: LayoutNode<T>, out: LayoutNode<T>[] = []): LayoutNode<T>[] {
  out.push(layoutNode);
  for (const c of layoutNode.children) flatten(c, out);
  return out;
}

// ---------- Filter pruning (Workstream 6) ----------
//
// Display-only transformation — NEVER touches manager_user_id. A node that
// doesn't match the active filters is hidden, but its (already-pruned)
// visible descendants are spliced up into its own position in the parent's
// child list, so an entire team never vanishes just because one filtered-out
// person sits above them. A chain of several consecutive hidden ancestors is
// walked through correctly since prune() recurses before checking
// visibility. Dragging a card onto a "promoted" grandparent is still
// correct — setMemberManager writes the real target, which genuinely is who
// now manages them from the visible tree's perspective.
export function pruneForestForDisplay(forest: OrgChartNode[], visibleUserIds: Set<string>): OrgChartNode[] {
  function prune(node: OrgChartNode): OrgChartNode[] {
    const prunedChildren = node.children.flatMap(prune);
    if (visibleUserIds.has(node.row.userId)) {
      return [{ row: node.row, children: prunedChildren }];
    }
    return prunedChildren;
  }
  return forest.flatMap(prune);
}

// ---------- Depth capping + branch expand (Workstream 6) ----------
//
// Runs after pruneForestForDisplay, before layout(). maxDepth counts total
// visible tiers from each root (root itself is depth 0) — maxDepth=2 shows
// a root plus its direct reports, then hides further descendants.
// expandedBranchRootIds is transient, per-session UI state (never saved):
// once a node's own userId is in that set, its ENTIRE subtree renders at
// full depth regardless of the cap, matching "drill into one branch during
// a presentation" rather than peeling back one level at a time.
export type DisplayNode = {
  row: WorkforceRow;
  children: DisplayNode[];
  // True when this node has real children that are hidden by the depth cap
  // — drives the "Expand branch" affordance in the card UI.
  hasHiddenChildren: boolean;
};

export function applyDepthCap(
  forest: OrgChartNode[],
  maxDepth: number | null,
  expandedBranchRootIds: Set<string>
): DisplayNode[] {
  function cap(node: OrgChartNode, depth: number, unlimited: boolean): DisplayNode {
    const nowUnlimited = unlimited || expandedBranchRootIds.has(node.row.userId);
    const childrenAllowed = nowUnlimited || maxDepth === null || depth + 1 < maxDepth;
    if (!childrenAllowed) {
      return { row: node.row, children: [], hasHiddenChildren: node.children.length > 0 };
    }
    return {
      row: node.row,
      children: node.children.map((c) => cap(c, depth + 1, nowUnlimited)),
      hasHiddenChildren: false,
    };
  }
  return forest.map((root) => cap(root, 0, false));
}
