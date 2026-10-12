import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminOrgId, liveConfigured, loginAdmin, loginMember, uuid, type Session } from "./helpers";

const BUCKET = "knowledge-hub-docs";

describe.skipIf(!liveConfigured)("live: Knowledge Hub / SCORM access and limits", () => {
  let admin: Session;
  let member: Session;
  let X: string;
  const contentIds: string[] = [];
  const files: string[] = [];
  let assigned: string;
  let unassigned: string;

  const makeContent = async (title: string) => {
    const id = uuid();
    const r = await admin.post("knowledge_hub_content", {
      id, organization_id: X, title, description: "TEST", storage_path: `${X}/${id}/scorm`, file_name: "index.html",
      file_size_bytes: 20, mime_type: "application/zip", completion_type: "scorm", passing_score_percent: 80,
      created_by: admin.userId, content_type: "scorm", scorm_version: "1.2", scorm_launch_path: "index.html",
    });
    expect(r.status).toBe(201);
    contentIds.push(id);
    return id;
  };

  beforeAll(async () => {
    admin = await loginAdmin();
    member = await loginMember();
    X = await adminOrgId(admin);
    assigned = await makeContent("TEST assigned");
    unassigned = await makeContent("TEST unassigned");
    for (const [id, name] of [[assigned, "index.html"], [unassigned, "secret.html"]] as const) {
      const p = `${X}/${id}/scorm/${name}`;
      expect(await admin.upload(BUCKET, p, "<html>TEST</html>", "text/html")).toBe(200);
      files.push(p);
    }
    const a = await admin.post("knowledge_hub_assignments", { content_id: assigned, employee_user_id: member.userId, assigned_by: admin.userId });
    expect(a.status).toBe(201);
  });

  afterAll(async () => {
    await admin?.removeObjects(BUCKET, files);
    for (const id of contentIds) await admin?.del(`knowledge_hub_content?id=eq.${id}`);
  });

  it("a member can read files assigned to them, not others", async () => {
    expect(await member.download(BUCKET, `${X}/${assigned}/scorm/index.html`)).toBe(200);
    expect(await member.download(BUCKET, `${X}/${unassigned}/scorm/secret.html`)).toBeGreaterThanOrEqual(400);
    expect(await member.list(BUCKET, `${X}/${unassigned}/scorm`)).toBe(0);
  });

  it("an admin can read any file in their company", async () => {
    expect(await admin.download(BUCKET, `${X}/${unassigned}/scorm/secret.html`)).toBe(200);
  });

  it("a member cannot upload or create content", async () => {
    expect(await member.upload(BUCKET, `${X}/${uuid()}/scorm/evil.html`, "<script>1</script>", "text/html")).toBeGreaterThanOrEqual(400);
    const r = await member.post("knowledge_hub_content", { organization_id: X, title: "evil", storage_path: "x", file_name: "x", file_size_bytes: 1, mime_type: "x", completion_type: "attestation", created_by: member.userId });
    expect([401, 403]).toContain(r.status);
  });

  it("package files that real SCORM packages contain are accepted by the bucket", async () => {
    for (const [name, type] of [["adlcp_rootv1p2.xsd", "application/xml"], ["notes.txt", "application/octet-stream"], ["pic.webp", "application/octet-stream"], ["font.ttf", "application/octet-stream"]] as const) {
      const p = `${X}/${assigned}/scorm/${name}`;
      expect(await admin.upload(BUCKET, p, "<x/>", type), name).toBe(200);
      files.push(p);
    }
  });

  it("completions: ownership-checked, status-validated, bounded", async () => {
    const complete = (id: string, status: string, cmi: Record<string, unknown> = {}, score: number | null = 80) =>
      member.rpc<{ score_percent: number | null; passed: boolean }[]>("submit_scorm_completion", { p_content_id: id, p_score_raw: score, p_lesson_status: status, p_cmi_data: cmi });

    expect((await complete(unassigned, "passed")).status).toBeGreaterThanOrEqual(400); // not assigned
    expect((await complete(assigned, "bogus")).status).toBeGreaterThanOrEqual(400); // invalid status
    const pass = await complete(assigned, "passed", { "cmi.core.lesson_location": "3" }, 90);
    expect(pass.status).toBe(200);
    expect(pass.body[0]).toEqual({ score_percent: 90, passed: true });
    const outOfRange = await complete(assigned, "completed", {}, 150);
    expect(outOfRange.body[0].score_percent).toBeNull();

    // oversized cmi data is dropped, the completion is still recorded
    const big = await complete(assigned, "incomplete", { blob: "x".repeat(300_000) }, 10);
    expect(big.status).toBe(200);
    const stored = await member.get<{ answers: Record<string, unknown> }[]>(`knowledge_hub_completions?content_id=eq.${assigned}&select=answers&order=completed_at.desc&limit=1`);
    expect(Object.keys(stored.body[0].answers)).toHaveLength(0);

    // direct writes are not possible
    const direct = await member.post("knowledge_hub_completions", { content_id: assigned, employee_user_id: member.userId, method: "scorm", score_percent: 100, passed: true, answers: {}, completed_at: new Date().toISOString() });
    expect([401, 403]).toContain(direct.status);

    // hourly cap (3 recorded above): the 61st in the hour is refused
    let refused = 0;
    for (let i = 0; i < 62; i++) if ((await complete(assigned, "incomplete", {}, 10)).status !== 200) refused++;
    expect(refused).toBeGreaterThanOrEqual(3);
  });
});
