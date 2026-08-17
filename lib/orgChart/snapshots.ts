"use server";

import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";

const MAX_NAME = 120;

export type OrgChartSnapshotMemberEntry = {
  userId: string;
  name: string;
  title: string | null;
  managerUserId: string | null;
  managerPositionId: string | null;
};

export type OrgChartSnapshotPositionEntry = {
  id: string;
  title: string;
  kind: "vacant_role" | "structural";
  status: string;
  parentPositionId: string | null;
  parentMemberUserId: string | null;
};

type OrgChartSnapshotPayload = {
  members: OrgChartSnapshotMemberEntry[];
  positions: OrgChartSnapshotPositionEntry[];
};

export type OrgChartSnapshotSummary = {
  id: string;
  name: string;
  createdAt: string;
  createdByName: string | null;
};

// Generic over {children: T[]} the same way tree.ts's OrgChartNode/DisplayNode
// are, so lib/orgChart/tree.ts's layout()/flatten()/subtreeWidth() work on
// this unchanged — a snapshot renders through the exact same layout math the
// live chart uses, just fed a much lighter node (a snapshot only ever needs
// a label/subtitle, never the full WorkforceRow shape the live chart's
// cards render).
export type OrgChartSnapshotTreeNode = {
  id: string;
  kind: "member" | "position";
  label: string;
  subtitle: string | null;
  positionKind: "vacant_role" | "structural" | null;
  children: OrgChartSnapshotTreeNode[];
};

export type OrgChartSnapshotDetail = {
  id: string;
  name: string;
  createdAt: string;
  roots: OrgChartSnapshotTreeNode[];
};

// Builds the point-in-time payload a snapshot stores — denormalized
// (name/title copied in, not just ids) so it stays meaningful to view even
// after the people/positions it references are later renamed, reassigned,
// or removed. Captures ALL positions including 'filled' ones (unlike
// listPositions()'s live-chart query, which excludes them) — a snapshot is
// a historical record, not a live view, so a since-filled vacancy's
// placement at snapshot time is still worth keeping.
async function loadSnapshotPayload(): Promise<{ organizationId: string; payload: OrgChartSnapshotPayload } | { error: string }> {
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) return { error: "Not authorized" };
  const supabase = await createClient();

  const [{ data: positionRows }, { data: managerPositionRows }] = await Promise.all([
    supabase
      .from("org_positions")
      .select("id, title, kind, status, parent_position_id, parent_member_user_id")
      .eq("organization_id", data.organizationId)
      .returns<{ id: string; title: string; kind: string; status: string; parent_position_id: string | null; parent_member_user_id: string | null }[]>(),
    // managerPositionId isn't on WorkforceRow (many unrelated pages consume
    // it and shouldn't pay for this join) — fetched separately, same
    // posture as lib/orgChart/positions.ts's listMemberManagerPositions.
    supabase
      .from("organization_members")
      .select("user_id, manager_position_id")
      .eq("organization_id", data.organizationId)
      .not("manager_position_id", "is", null)
      .returns<{ user_id: string; manager_position_id: string }[]>(),
  ]);

  const managerPositionByUser = new Map((managerPositionRows ?? []).map((r) => [r.user_id, r.manager_position_id]));

  const payload: OrgChartSnapshotPayload = {
    members: data.rows.map((r) => ({
      userId: r.userId,
      name: r.name,
      title: r.title,
      managerUserId: r.managerUserId,
      managerPositionId: managerPositionByUser.get(r.userId) ?? null,
    })),
    positions: (positionRows ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      kind: p.kind as "vacant_role" | "structural",
      status: p.status,
      parentPositionId: p.parent_position_id,
      parentMemberUserId: p.parent_member_user_id,
    })),
  };

  return { organizationId: data.organizationId, payload };
}

export async function createOrgChartSnapshot(name: string): Promise<{ success: true; id: string } | { error: string }> {
  const trimmed = name.trim().slice(0, MAX_NAME);
  if (!trimmed) return { error: "Give this snapshot a name" };

  const loaded = await loadSnapshotPayload();
  if ("error" in loaded) return loaded;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: inserted, error } = await supabase
    .from("org_chart_snapshots")
    .insert({
      organization_id: loaded.organizationId,
      name: trimmed,
      snapshot: loaded.payload,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !inserted) {
    console.error("createOrgChartSnapshot failed:", error);
    return { error: "Could not save snapshot — the database may need migration 0121 run first." };
  }
  return { success: true, id: inserted.id };
}

export async function listOrgChartSnapshots(): Promise<OrgChartSnapshotSummary[]> {
  const data = await buildCompanyData();
  if (!data.organizationId) return [];
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("org_chart_snapshots")
    .select("id, name, created_at, created_by")
    .eq("organization_id", data.organizationId)
    .order("created_at", { ascending: false })
    .returns<{ id: string; name: string; created_at: string; created_by: string | null }[]>();
  if (!rows || rows.length === 0) return [];

  const creatorIds = [...new Set(rows.map((r) => r.created_by).filter((v): v is string => !!v))];
  const { data: profiles } = creatorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", creatorIds).returns<{ id: string; full_name: string | null }[]>()
    : { data: [] as { id: string; full_name: string | null }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    createdByName: r.created_by ? (nameById.get(r.created_by) ?? null) : null,
  }));
}

// Resolves a stored snapshot's payload into a reporting-line forest — every
// label comes from the snapshot's own denormalized data, never a live join,
// so this stays accurate even for a long-since-changed org. Structurally
// the same shape as the live chart's buildReportingForest (tree.ts): a node
// with no resolvable parent tag becomes a root rather than being dropped,
// and a visited-set guards against ever hanging on a corrupt chain.
export async function getOrgChartSnapshotDetail(id: string): Promise<OrgChartSnapshotDetail | null> {
  const data = await buildCompanyData();
  if (!data.organizationId) return null;
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("org_chart_snapshots")
    .select("id, name, created_at, snapshot")
    .eq("organization_id", data.organizationId)
    .eq("id", id)
    .maybeSingle<{ id: string; name: string; created_at: string; snapshot: OrgChartSnapshotPayload }>();
  if (!row) return null;

  const payload = row.snapshot;

  type Entry = { node: OrgChartSnapshotTreeNode; parentTag: string | null };
  const byTag = new Map<string, Entry>();

  for (const m of payload.members) {
    const tag = `member:${m.userId}`;
    const parentTag = m.managerUserId ? `member:${m.managerUserId}` : m.managerPositionId ? `position:${m.managerPositionId}` : null;
    byTag.set(tag, { node: { id: tag, kind: "member", label: m.name, subtitle: m.title, positionKind: null, children: [] }, parentTag });
  }
  for (const p of payload.positions) {
    const tag = `position:${p.id}`;
    const parentTag = p.parentPositionId ? `position:${p.parentPositionId}` : p.parentMemberUserId ? `member:${p.parentMemberUserId}` : null;
    byTag.set(tag, { node: { id: tag, kind: "position", label: p.title, subtitle: null, positionKind: p.kind, children: [] }, parentTag });
  }

  const childrenByParentTag = new Map<string, string[]>();
  const rootTags: string[] = [];
  for (const [tag, entry] of byTag) {
    // A parent tag that isn't itself a node in this snapshot (removed since,
    // or simply never existed) degrades to "unassigned root" — same policy
    // as the live chart, nobody just vanishes from the picture.
    if (entry.parentTag && byTag.has(entry.parentTag) && entry.parentTag !== tag) {
      const list = childrenByParentTag.get(entry.parentTag) ?? [];
      list.push(tag);
      childrenByParentTag.set(entry.parentTag, list);
    } else {
      rootTags.push(tag);
    }
  }

  function build(tag: string, visited: Set<string>): OrgChartSnapshotTreeNode {
    const entry = byTag.get(tag)!;
    if (visited.has(tag)) return { ...entry.node, children: [] };
    const nextVisited = new Set(visited).add(tag);
    const children = (childrenByParentTag.get(tag) ?? [])
      .map((childTag) => build(childTag, nextVisited))
      .sort((a, b) => a.label.localeCompare(b.label));
    return { ...entry.node, children };
  }

  const roots = rootTags.map((tag) => build(tag, new Set())).sort((a, b) => a.label.localeCompare(b.label));

  return { id: row.id, name: row.name, createdAt: row.created_at, roots };
}
