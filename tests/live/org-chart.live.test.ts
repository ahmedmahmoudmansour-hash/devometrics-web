import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminOrgId, liveConfigured, loginAdmin, loginMember, type Session } from "./helpers";

type Row = { id: string };

describe.skipIf(!liveConfigured)("live: org chart privacy and reporting-line integrity", () => {
  let admin: Session;
  let member: Session;
  let X: string;
  const created: [string, string][] = [];
  const positionIds: string[] = [];
  let original: { admin: string | null; member: string | null };

  beforeAll(async () => {
    admin = await loginAdmin();
    member = await loginMember();
    X = await adminOrgId(admin);
    const rows = await admin.get<{ user_id: string; manager_user_id: string | null }[]>(`organization_members?organization_id=eq.${X}&select=user_id,manager_user_id`);
    original = {
      admin: rows.body.find((r) => r.user_id === admin.userId)?.manager_user_id ?? null,
      member: rows.body.find((r) => r.user_id === member.userId)?.manager_user_id ?? null,
    };
  });

  afterAll(async () => {
    for (const [table, key] of created) await admin?.del(`${table}?${key}`);
    // positions have no plain DELETE policy; they are removed through the function
    for (const id of positionIds) await admin?.rpc("delete_org_position", { target_position_id: id });
    // put reporting lines back exactly as found
    await admin?.patch(`organization_members?organization_id=eq.${X}&user_id=eq.${admin.userId}`, { manager_user_id: original?.admin ?? null });
    await admin?.patch(`organization_members?organization_id=eq.${X}&user_id=eq.${member.userId}`, { manager_user_id: original?.member ?? null });
  });

  it("restructuring data is visible to admins only", async () => {
    const pos = await admin.post<Row[]>("org_positions", { organization_id: X, kind: "vacant_role", status: "future", title: "TEST planned role", created_by: admin.userId });
    expect(pos.status).toBe(201);
    positionIds.push(pos.body[0].id);
    const snap = await admin.post<Row[]>("org_chart_snapshots", { organization_id: X, name: "TEST draft", snapshot: { members: [], positions: [] }, created_by: admin.userId });
    created.push(["org_chart_snapshots", `id=eq.${snap.body[0].id}`]);
    const view = await admin.post<Row[]>("org_chart_saved_views", { organization_id: X, name: "TEST view", config: {}, created_by: admin.userId });
    created.push(["org_chart_saved_views", `id=eq.${view.body[0].id}`]);
    const note = await admin.post("org_chart_annotations", { organization_id: X, annotations: [{ id: "t", text: "TEST", x: 0, y: 0 }] });
    created.push(["org_chart_annotations", `organization_id=eq.${X}`]);
    expect(note.status).toBe(201);

    for (const t of ["org_positions", "org_chart_snapshots", "org_chart_saved_views", "org_chart_annotations"]) {
      const m = await member.get<unknown[]>(`${t}?organization_id=eq.${X}&select=organization_id`);
      expect(m.body, `${t} as member`).toEqual([]);
      const a = await admin.get<unknown[]>(`${t}?organization_id=eq.${X}&select=organization_id`);
      expect(a.body.length, `${t} as admin`).toBeGreaterThanOrEqual(1);
    }
    expect((await member.post("org_positions", { organization_id: X, kind: "vacant_role", status: "open", title: "evil", created_by: member.userId })).status).toBeGreaterThanOrEqual(400);
  });

  it("the database refuses a self-manager and a reporting loop", async () => {
    const self = await admin.patch(`organization_members?organization_id=eq.${X}&user_id=eq.${admin.userId}`, { manager_user_id: admin.userId });
    expect(self.status).toBe(400);

    const ok = await admin.patch<Row[]>(`organization_members?organization_id=eq.${X}&user_id=eq.${member.userId}`, { manager_user_id: admin.userId });
    expect(ok.status).toBe(200);
    const loop = await admin.patch(`organization_members?organization_id=eq.${X}&user_id=eq.${admin.userId}`, { manager_user_id: member.userId });
    expect(loop.status).toBe(400);
    expect((loop.body as unknown as { code: string }).code).toBe("23514");
  });
});
