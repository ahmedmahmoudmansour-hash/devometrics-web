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
