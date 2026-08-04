// Merged reporting-line tree — combines real employees (WorkforceRow) and
// vacant/structural positions (OrgPositionRow) into one tree for the Org
// Chart's live canvas. Deliberately a NEW sibling file rather than
// genericizing tree.ts's buildReportingForest/pruneForestForDisplay/
// applyDepthCap in place: those are just-shipped, tested, and still the
// only source of truth for the real employee-only tree; this file mirrors
// their logic structurally over a tagged union instead of touching them.
// tree.ts's layout/flatten/subtreeWidth/wouldCreateCycle/CARD_*/LEVEL_H are
// reused completely unchanged — layout/flatten/subtreeWidth are already
// generic over `{children: T[]}`, and wouldCreateCycle is already generic
// over an opaque `Map<string, string | null>`.
import type { WorkforceRow } from "@/lib/organizations/aggregate";
import type { OrgPositionRow } from "@/lib/orgChart/positions";

export type MergedOrgChartNode =
  | { kind: "member"; id: string; row: WorkforceRow; children: MergedOrgChartNode[] }
  | { kind: "position"; id: string; position: OrgPositionRow; children: MergedOrgChartNode[] };

export type MergedDisplayNode = (
  | { kind: "member"; id: string; row: WorkforceRow }
  | { kind: "position"; id: string; position: OrgPositionRow }
) & {
  children: MergedDisplayNode[];
  // True when this node has real children hidden by the depth cap — drives
  // the "Expand branch" affordance, same as tree.ts's DisplayNode.
  hasHiddenChildren: boolean;
};

export const memberTag = (userId: string): string => `member:${userId}`;
export const positionTag = (positionId: string): string => `position:${positionId}`;

// The tagged edge map wouldCreateCycle (tree.ts) walks — one entry per
// member and per position, value is the tagged parent id or null at a
// root. Reused as-is by wouldCreateCycle since it only ever treats its
// inputs as opaque string keys.
export function buildMergedManagerEdgeMap(
  rows: WorkforceRow[],
  positions: OrgPositionRow[],
  memberManagerPositions: Map<string, string>
): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const row of rows) {
    const positionParentId = memberManagerPositions.get(row.userId);
    if (positionParentId) {
      map.set(memberTag(row.userId), positionTag(positionParentId));
    } else {
      map.set(memberTag(row.userId), row.managerUserId ? memberTag(row.managerUserId) : null);
    }
  }
  for (const p of positions) {
    if (p.parentPositionId) map.set(positionTag(p.id), positionTag(p.parentPositionId));
    else if (p.parentMemberUserId) map.set(positionTag(p.id), memberTag(p.parentMemberUserId));
    else map.set(positionTag(p.id), null);
  }
  return map;
}

// Builds the merged forest. Roots are members/positions with no manager
// set, OR whose manager reference doesn't resolve to a live node in this
// same roster (left, archived, filled-and-removed, or simply stale) —
// same "never silently drop a node" posture as buildReportingForest.
export function buildMergedReportingForest(
  rows: WorkforceRow[],
  positions: OrgPositionRow[],
  memberManagerPositions: Map<string, string>
): MergedOrgChartNode[] {
  const memberIds = new Set(rows.map((r) => r.userId));
  const positionIds = new Set(positions.map((p) => p.id));

  type RawEntry = { tag: string; parentTag: string | null; sortKey: string; build: (children: MergedOrgChartNode[]) => MergedOrgChartNode };
  const entries: RawEntry[] = [];

  for (const row of rows) {
    const positionParentId = memberManagerPositions.get(row.userId);
    let parentTag: string | null = null;
    if (positionParentId && positionIds.has(positionParentId)) {
      parentTag = positionTag(positionParentId);
    } else if (row.managerUserId && row.managerUserId !== row.userId && memberIds.has(row.managerUserId)) {
      parentTag = memberTag(row.managerUserId);
    }
    entries.push({
      tag: memberTag(row.userId),
      parentTag,
      sortKey: row.name,
      build: (children) => ({ kind: "member", id: memberTag(row.userId), row, children }),
    });
  }

  for (const p of positions) {
    let parentTag: string | null = null;
    if (p.parentPositionId && p.parentPositionId !== p.id && positionIds.has(p.parentPositionId)) {
      parentTag = positionTag(p.parentPositionId);
    } else if (p.parentMemberUserId && memberIds.has(p.parentMemberUserId)) {
      parentTag = memberTag(p.parentMemberUserId);
    }
    entries.push({
      tag: positionTag(p.id),
      parentTag,
      sortKey: p.title,
      build: (children) => ({ kind: "position", id: positionTag(p.id), position: p, children }),
    });
  }

  const byTag = new Map(entries.map((e) => [e.tag, e]));
  const childrenByParentTag = new Map<string, RawEntry[]>();
  const roots: RawEntry[] = [];
  for (const e of entries) {
    if (e.parentTag && byTag.has(e.parentTag)) {
      const list = childrenByParentTag.get(e.parentTag) ?? [];
      list.push(e);
      childrenByParentTag.set(e.parentTag, list);
    } else {
      roots.push(e);
    }
  }

  // Visited-set cycle guard — defends the render path the same way
  // buildReportingForest's does; the real authority is the cycle check
  // inside setMemberManager/setMemberManagerPosition/setPositionParent
  // before any write is ever accepted.
  function buildNode(entry: RawEntry, visited: Set<string>): MergedOrgChartNode {
    if (visited.has(entry.tag)) return entry.build([]);
    const nextVisited = new Set(visited).add(entry.tag);
    const children = (childrenByParentTag.get(entry.tag) ?? []).map((c) => buildNode(c, nextVisited));
    return entry.build(children);
  }

  return [...roots].sort((a, b) => a.sortKey.localeCompare(b.sortKey)).map((e) => buildNode(e, new Set()));
}

// Display-only transformation, identical splice-up behavior to tree.ts's
// pruneForestForDisplay — NEVER touches manager_user_id/manager_position_id
// or a position's parent columns.
export function pruneMergedForestForDisplay(forest: MergedOrgChartNode[], visibleIds: Set<string>): MergedOrgChartNode[] {
  function withChildren(node: MergedOrgChartNode, children: MergedOrgChartNode[]): MergedOrgChartNode {
    return node.kind === "member" ? { ...node, children } : { ...node, children };
  }
  function prune(node: MergedOrgChartNode): MergedOrgChartNode[] {
    const prunedChildren = node.children.flatMap(prune);
    if (visibleIds.has(node.id)) return [withChildren(node, prunedChildren)];
    return prunedChildren;
  }
  return forest.flatMap(prune);
}

// Identical semantics to tree.ts's applyDepthCap, over the merged type.
// Runs after pruneMergedForestForDisplay, before layout().
export function applyMergedDepthCap(
  forest: MergedOrgChartNode[],
  maxDepth: number | null,
  expandedBranchRootIds: Set<string>
): MergedDisplayNode[] {
  function cap(node: MergedOrgChartNode, depth: number, unlimited: boolean): MergedDisplayNode {
    const nowUnlimited = unlimited || expandedBranchRootIds.has(node.id);
    const childrenAllowed = nowUnlimited || maxDepth === null || depth + 1 < maxDepth;
    const base = node.kind === "member" ? { kind: "member" as const, id: node.id, row: node.row } : { kind: "position" as const, id: node.id, position: node.position };
    if (!childrenAllowed) {
      return { ...base, children: [], hasHiddenChildren: node.children.length > 0 };
    }
    return { ...base, children: node.children.map((c) => cap(c, depth + 1, nowUnlimited)), hasHiddenChildren: false };
  }
  return forest.map((root) => cap(root, 0, false));
}
