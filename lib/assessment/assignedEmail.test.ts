import { beforeEach, describe, expect, it, vi } from "vitest";

const sendEmail = vi.fn();
const state = vi.hoisted(() => ({ real: false }));
// The mail service is replaced, except in the one test that runs the real sender with no Resend settings (so it fails the way
// it does in an unconfigured environment).
vi.mock("@/lib/email/resend", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email/resend")>("@/lib/email/resend");
  return { sendEmail: (...a: Parameters<typeof actual.sendEmail>) => (state.real ? actual.sendEmail(...a) : sendEmail(...a)) };
});

import { ASSESSMENT_EMAILS_ENABLED, buildAssessmentAssignedEmail, sendAssessmentAssignedEmail, type AssignedEmailInput } from "./assignedEmail";

const check = (over: Partial<Extract<AssignedEmailInput, { kind: "check" }>> = {}): AssignedEmailInput => ({
  kind: "check", language: "en", employeeName: "Hend", orgName: "Acme Co", assignerName: "Ahmed", roleTitle: "Customer Service Manager",
  url: "https://devometrics.com/dashboard/knowledge-check/abc", questionCount: 12, minutes: 15, ...over,
});
const role = (over: Partial<Extract<AssignedEmailInput, { kind: "role" }>> = {}): AssignedEmailInput => ({
  kind: "role", language: "en", employeeName: "Hend", orgName: "Acme Co", assignerName: "Ahmed", roleTitle: "Customer Service Manager",
  url: "https://devometrics.com/dashboard/role-assessment/xyz", competencyCount: 6, questionsPerCompetency: 3, retentionMonths: 12, ...over,
});

describe("knowledge check email", () => {
  const m = buildAssessmentAssignedEmail(check());
  it("says who, where, which role, how many questions and how long", () => {
    for (const s of ["Hello Hend", "Ahmed", "Acme Co", "Customer Service Manager", "12 questions", "15 minutes in total"]) expect(m.html).toContain(s);
    expect(m.subject).toContain("knowledge check");
  });
  it("states the rules a person needs to know before starting", () => {
    expect(m.html).toContain("cannot be paused or restarted");
    expect(m.html).toContain("submits itself");
    expect(m.html).toContain("Leaving the page is recorded");
    expect(m.html).toContain("cannot be changed");
    expect(m.html).toContain("not a basis for a hiring or promotion decision");
  });
  it("links straight to the check", () => {
    expect(m.html).toContain('href="https://devometrics.com/dashboard/knowledge-check/abc"');
  });
});

describe("role assessment email", () => {
  const m = buildAssessmentAssignedEmail(role());
  it("describes the written assessment and what happens to the answers", () => {
    for (const s of ["6 competencies", "3 per competency", "pasting text into the answer boxes is turned off", "scored with AI", "confirm or adjust", "kept for 12 months"]) expect(m.html).toContain(s);
    expect(m.html).toContain('href="https://devometrics.com/dashboard/role-assessment/xyz"');
  });
});

describe("Arabic", () => {
  it("is right to left, in Arabic, and still carries the facts", () => {
    const c = buildAssessmentAssignedEmail(check({ language: "ar" }));
    expect(c.html).toContain('dir="rtl"');
    expect(c.html).toContain("12 سؤالًا");
    expect(c.html).toContain("15 دقائق في المجموع");
    expect(c.subject).toContain("اختبار معرفة");
    const r = buildAssessmentAssignedEmail(role({ language: "ar" }));
    expect(r.html).toContain('dir="rtl"');
    expect(r.html).toContain("6 كفاءة");
    expect(r.html).toContain("12 شهرًا");
  });
});

describe("safety", () => {
  it("escapes names so nothing can inject markup", () => {
    const m = buildAssessmentAssignedEmail(check({ employeeName: "<script>x</script>", assignerName: "A&B", roleTitle: "Mgr <b>" }));
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
    expect(m.html).toContain("A&amp;B");
  });
});

// The sender, with the database and the mail service replaced.
function db(rows: { employee?: { full_name: string | null; email: string } | null; assigner?: { full_name: string | null; email: string } | null; org?: { name: string } | null }) {
  const table = (name: string, id?: string) => ({
    select: () => ({
      eq: (_c: string, v: string) => ({
        maybeSingle: async () => ({ data: name === "organizations" ? rows.org ?? null : v === "emp" ? rows.employee ?? null : rows.assigner ?? null }),
      }),
    }),
    id,
  });
  return { from: (n: string) => table(n) } as never;
}
const base = { organizationId: "org", employeeUserId: "emp", assignerUserId: "boss", roleTitle: "CSM", language: "en" as const, detail: { kind: "check" as const, questionCount: 8, minutes: 10, checkId: "c1" } };

describe("sending", () => {
  beforeEach(() => {
    sendEmail.mockReset();
    state.real = false;
  });
  it("sends to the employee's address and reports success", async () => {
    sendEmail.mockImplementation(async () => undefined);
    const ok = await sendAssessmentAssignedEmail(db({ employee: { full_name: "Hend", email: "hend@example.com" }, assigner: { full_name: "Ahmed", email: "a@example.com" }, org: { name: "Acme" } }), base, { enabled: true });
    expect(ok).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toBe("hend@example.com");
    expect(String(sendEmail.mock.calls[0][1])).toContain("Acme");
  });
  it("does not email someone who assigned it to themselves", async () => {
    expect(await sendAssessmentAssignedEmail(db({}), { ...base, employeeUserId: "boss" }, { enabled: true })).toBeNull();
    expect(sendEmail).not.toHaveBeenCalled();
  });
  it("does nothing when the person has no email on file", async () => {
    expect(await sendAssessmentAssignedEmail(db({ employee: null, org: { name: "Acme" } }), base, { enabled: true })).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });
  it("returns false instead of throwing when the mail service fails, so the assignment stands", async () => {
    state.real = true;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    const ok = await sendAssessmentAssignedEmail(db({ employee: { full_name: "Hend", email: "hend@example.com" }, assigner: { full_name: "A", email: "a@example.com" }, org: { name: "Acme" } }), base, { enabled: true });
    expect(ok).toBe(false);
  });
  it("sends nothing while the master switch is off (the default until the wording is approved)", async () => {
    expect(ASSESSMENT_EMAILS_ENABLED).toBe(false);
    const ok = await sendAssessmentAssignedEmail(db({ employee: { full_name: "Hend", email: "hend@example.com" }, assigner: { full_name: "A", email: "a@example.com" }, org: { name: "Acme" } }), base);
    expect(ok).toBeNull();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
