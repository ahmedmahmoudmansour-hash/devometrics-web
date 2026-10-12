import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminOrgId, anon, createThrowawayOrg, liveConfigured, loginAdmin, loginMember, type Session } from "./helpers";

describe.skipIf(!liveConfigured)("live: tenant isolation and function exposure", () => {
  let admin: Session;
  let member: Session;
  let X: string;
  let other: Awaited<ReturnType<typeof createThrowawayOrg>>;

  beforeAll(async () => {
    admin = await loginAdmin();
    member = await loginMember();
    X = await adminOrgId(admin);
    // A second company that neither test user belongs to as an outsider is
    // created by the member, who therefore owns it; the admin is the outsider.
    other = await createThrowawayOrg(member, "isolation");
  });

  afterAll(async () => {
    await other?.cleanup();
  });

  it("anonymous callers cannot read company data", async () => {
    const a = anon();
    for (const table of ["organizations", "organization_members", "profiles", "knowledge_hub_content", "hiring_candidates", "leave_requests"]) {
      const r = await a.get<unknown[]>(`${table}?select=*&limit=1`);
      expect(r.status === 200 ? r.body : []).toEqual([]);
    }
  });

  it("anonymous callers cannot execute internal functions", async () => {
    const a = anon();
    const attempts: [string, Record<string, unknown>][] = [
      ["record_score_event", {}],
      ["org_id_for_user", { p_user_id: "00000000-0000-0000-0000-000000000000" }],
      ["history_manager_label", { p_user_id: "00000000-0000-0000-0000-000000000000", p_position_id: null }],
      ["org_ai_spend_this_month", { target_org_id: X }],
    ];
    for (const [fn, args] of attempts) {
      const r = await a.rpc(fn, args);
      // 401/403 (denied) or 404 (not exposed): anything but a successful call.
      expect([401, 403, 404]).toContain(r.status);
    }
  });

  it("a signed-in user outside a company reads nothing of it", async () => {
    // admin is not a member of `other`
    for (const table of ["organization_members", "job_postings", "hiring_candidates", "knowledge_hub_content", "org_positions", "leave_requests", "attendance_records"]) {
      const r = await admin.get<unknown[]>(`${table}?organization_id=eq.${other.id}&select=id`);
      expect(r.status).toBe(200);
      expect(r.body).toEqual([]);
    }
  });

  it("an outsider cannot write rows into another company", async () => {
    const attempts: [string, Record<string, unknown>][] = [
      ["job_postings", { organization_id: other.id, title: "TEST intrusion", created_by: admin.userId }],
      ["org_positions", { organization_id: other.id, kind: "vacant_role", status: "open", title: "TEST intrusion", created_by: admin.userId }],
      ["public_holidays", { organization_id: other.id, holiday_date: "2030-01-01", name: "TEST" }],
      ["organization_invites", { organization_id: other.id, email: "intruder@example.invalid", invited_by: admin.userId }],
    ];
    for (const [table, row] of attempts) {
      const r = await admin.post(table, row);
      expect([401, 403]).toContain(r.status);
    }
  });

  it("a user cannot join a company without an invitation", async () => {
    const r = await admin.post("organization_members", { organization_id: other.id, user_id: admin.userId, role: "member" });
    expect([401, 403]).toContain(r.status);
  });

  it("join-by-code reveals nothing about whether a code exists", async () => {
    const a = await admin.rpc<unknown>("join_organization_by_code", { p_code: "definitely-not-a-real-code" });
    const b = await admin.rpc<unknown>("join_organization_by_code", { p_code: "another-wrong-code-9999" });
    expect(a.status).toBe(b.status);
    expect(JSON.stringify(a.body)).toBe(JSON.stringify(b.body));
  });

  it("the contact form table cannot be written directly", async () => {
    const r = await anon().post("contact_inquiries", { type: "support", name: "TEST", email: "t@example.invalid", message: "TEST" });
    expect([401, 403]).toContain(r.status);
  });

  it("the contact form function validates its input", async () => {
    const a = anon();
    const base = { p_type: "support", p_name: "TEST", p_email: "t@example.invalid", p_message: "TEST" };
    expect((await a.rpc("submit_contact_inquiry", { ...base, p_email: "not an email" })).status).toBe(400);
    expect((await a.rpc("submit_contact_inquiry", { ...base, p_type: "spam" })).status).toBe(400);
    expect((await a.rpc("submit_contact_inquiry", { ...base, p_message: "x".repeat(5001) })).status).toBe(400);
  });

  it("platform chat limit is enforced across calls and per visitor", async () => {
    const a = anon();
    const key = `live-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const results: unknown[] = [];
    for (let i = 0; i < 10; i++) results.push((await a.rpc<boolean>("platform_chat_allow", { p_key: key })).body);
    expect(results.slice(0, 8)).toEqual(Array(8).fill(true));
    expect(results.slice(8)).toEqual([false, false]);
    const fresh = await a.rpc<boolean>("platform_chat_allow", { p_key: `${key}-other` });
    expect(fresh.body).toBe(true);
    const direct = await a.get("platform_chat_hits?select=*&limit=1");
    expect([401, 403]).toContain(direct.status);
  });
});
