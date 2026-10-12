import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminOrgId, createThrowawayOrg, liveConfigured, loginAdmin, loginMember, uuid, type Session } from "./helpers";

type Row = { id: string };

// The member creates a throwaway company Y and runs the hiring pipeline in it
// as its admin. The "admin" test account plays the candidate who is hired: an
// outsider to Y until the invite is accepted.
describe.skipIf(!liveConfigured)("live: hiring pipeline through to hire", () => {
  let recruiter: Session; // admin of throwaway company Y
  let candidate: Session; // the person being hired
  let Y: Awaited<ReturnType<typeof createThrowawayOrg>>;
  let X: string; // an unrelated company (the candidate's own)
  let posting: string;
  let candidateId: string;
  let otherCandidateId: string;
  const cleanupRows: [Session, string, string][] = [];

  beforeAll(async () => {
    recruiter = await loginMember();
    candidate = await loginAdmin();
    X = await adminOrgId(candidate);
    Y = await createThrowawayOrg(recruiter, "hiring");
  });

  afterAll(async () => {
    for (const [s, table, id] of cleanupRows.reverse()) await s.del(`${table}?id=eq.${id}`);
    await candidate?.del(`organization_members?organization_id=eq.${Y?.id}&user_id=eq.${candidate.userId}`);
    await Y?.cleanup();
  });

  it("an admin can create a posting, add candidates, score, note and move stages", async () => {
    let r = await recruiter.post<Row[]>("job_postings", { organization_id: Y.id, title: "TEST Engineer", status: "open", created_by: recruiter.userId });
    expect(r.status).toBe(201);
    posting = r.body[0].id;

    r = await recruiter.post<Row[]>("hiring_candidates", { organization_id: Y.id, posting_id: posting, full_name: "TEST Candidate", email: candidate.email.toLowerCase(), created_by: recruiter.userId });
    expect(r.status).toBe(201);
    candidateId = r.body[0].id;
    r = await recruiter.post<Row[]>("hiring_candidates", { organization_id: Y.id, posting_id: posting, full_name: "TEST Other", email: "other-candidate@example.invalid", created_by: recruiter.userId });
    otherCandidateId = r.body[0].id;

    const competencies = [{ dimension: "technical", currentLevel: 62, targetLevel: 70 }];
    for (const [cid, score] of [[candidateId, 62], [otherCandidateId, 40]] as const) {
      const s = await recruiter.post("hiring_candidate_cv_scores", { organization_id: Y.id, candidate_id: cid, posting_id: posting, target_role: "TEST Engineer", job_description: "x", cv_text: "TEST CV", competencies, career_health_score: score, scored_by: recruiter.userId });
      expect(s.status).toBe(201);
    }
    expect((await recruiter.post("hiring_candidate_interview_notes", { organization_id: Y.id, candidate_id: candidateId, author_id: recruiter.userId, note: "TEST note" })).status).toBe(201);
    expect((await recruiter.patch(`hiring_candidates?id=eq.${candidateId}`, { stage: "offer" })).status).toBe(200);
  });

  it("people outside the company see none of it", async () => {
    for (const t of ["job_postings", "hiring_candidates", "hiring_candidate_cv_scores", "hiring_candidate_interview_notes", "hiring_candidate_assessments", "hiring_candidate_stage_history"]) {
      const r = await candidate.get<unknown[]>(`${t}?organization_id=eq.${Y.id}&select=id`);
      expect(r.body, t).toEqual([]);
    }
  });

  it("rows cannot point at another company's posting or candidate", async () => {
    const cross = await candidate.post("hiring_candidates", { organization_id: X, posting_id: posting, full_name: "TEST CROSS", email: "x@example.invalid", created_by: candidate.userId });
    expect(cross.status).toBe(400);
    expect((cross.body as unknown as { code: string }).code).toBe("23514");
  });

  it("hiring sends an invite carrying the candidate, once", async () => {
    const first = await recruiter.post<Row[]>("organization_invites", { organization_id: Y.id, email: candidate.email.toLowerCase(), invited_by: recruiter.userId, candidate_id: candidateId, is_new_hire: true });
    expect(first.status).toBe(201);
    const again = await recruiter.post("organization_invites", { organization_id: Y.id, email: candidate.email.toLowerCase(), invited_by: recruiter.userId, candidate_id: candidateId, is_new_hire: true });
    expect(again.status).toBe(409);
  });

  it("the candidate joins through the invite and sees only their own CV score", async () => {
    const pending = await candidate.get<Row[]>(`organization_invites?organization_id=eq.${Y.id}&accepted_at=is.null&select=id`);
    expect(pending.body).toHaveLength(1);

    const join = await candidate.post("organization_members", { organization_id: Y.id, user_id: candidate.userId, role: "member" });
    expect(join.status).toBe(201);

    const mine = await candidate.get<{ candidate_id: string }[]>("hiring_candidate_cv_scores?select=candidate_id");
    expect(mine.body.map((x) => x.candidate_id)).toEqual([candidateId]);

    // a new, ordinary member can read nothing else in the pipeline and cannot write
    for (const t of ["hiring_candidates", "hiring_candidate_interview_notes", "hiring_candidate_assessments", "job_postings"]) {
      const r = await candidate.get<unknown[]>(`${t}?organization_id=eq.${Y.id}&select=id`);
      expect(r.body, t).toEqual([]);
    }
    const write = await candidate.post("hiring_candidate_interview_notes", { organization_id: Y.id, candidate_id: candidateId, author_id: candidate.userId, note: "x" });
    expect([401, 403]).toContain(write.status);
  });

  it("two companies inviting the same address does not break the lookup", async () => {
    // Same query shape the sign-up flow uses: oldest pending invite, limit 1.
    const dup = await candidate.post<Row[]>("organization_invites", { organization_id: X, email: candidate.email.toLowerCase(), invited_by: candidate.userId });
    if (dup.body?.[0]) cleanupRows.push([candidate, "organization_invites", dup.body[0].id]);
    const rows = await candidate.get<Row[]>(`organization_invites?select=id&accepted_at=is.null&email=ilike.${encodeURIComponent(candidate.email.toLowerCase())}&order=created_at.asc&limit=1`);
    expect(rows.status).toBe(200);
    expect(rows.body.length).toBeLessThanOrEqual(1);
  });

  it("CV files are private to the company's admins", async () => {
    const path = `${Y.id}/${uuid()}.pdf`;
    const pdf = Buffer.from("%PDF-1.4\n%%EOF");
    const up = await recruiter.upload("candidate-cvs", path, pdf, "application/pdf");
    expect(up).toBe(200);
    expect(await candidate.download("candidate-cvs", path)).toBeGreaterThanOrEqual(400);
    expect(await candidate.upload("candidate-cvs", `${Y.id}/${uuid()}.pdf`, pdf, "application/pdf")).toBeGreaterThanOrEqual(400);
    await recruiter.removeObjects("candidate-cvs", [path]);
  });
});
