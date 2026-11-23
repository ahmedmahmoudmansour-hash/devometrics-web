import { describe, expect, it } from "vitest";
import { validatePlacements, type PlaceMember, type PlaceRole, type PlaceRow } from "./placeCore";

const members: PlaceMember[] = [
  { memberId: "m1", email: "hend@acme.com", currentRoleId: null },
  { memberId: "m2", email: "sherif@acme.com", currentRoleId: "r-agent" },
  { memberId: "m3", email: "Mona@Acme.com", currentRoleId: null },
];
const roles: PlaceRole[] = [
  { id: "r-mgr", title: "Customer Service Manager", family: "Customer Service" },
  { id: "r-agent", title: "Customer Service Agent", family: "Customer Service" },
  { id: "r-lead-cs", title: "Team Lead", family: "Customer Service" },
  { id: "r-lead-sales", title: "Team Lead", family: "Sales" },
];
const row = (over: Partial<PlaceRow> = {}): PlaceRow => ({ email: "hend@acme.com", title: "Customer Service Manager", family: "", ...over });

describe("placing people in jobs from a file", () => {
  it("never places someone who has left the company, and says why", () => {
    const v = validatePlacements([row({ email: "gone@acme.com" })], [...members, { memberId: "m9", email: "gone@acme.com", currentRoleId: null, left: true }], roles);
    expect(v).toMatchObject({ ok: 0, errors: 1 });
    expect(v.results[0].message).toContain("left your company");
    expect(v.changes[0]).toBeNull();
  });
  it("places a person in a job", () => {
    const v = validatePlacements([row()], members, roles);
    expect(v).toMatchObject({ ok: 1, unchanged: 0, errors: 0 });
    expect(v.changes[0]).toEqual({ memberId: "m1", roleId: "r-mgr" });
  });
  it("matches emails and titles ignoring case and extra spaces", () => {
    const v = validatePlacements([row({ email: "  MONA@acme.COM ", title: "customer  service   agent" })], members, roles);
    expect(v.changes[0]).toEqual({ memberId: "m3", roleId: "r-agent" });
  });
  it("leaves alone someone already in that job", () => {
    const v = validatePlacements([row({ email: "sherif@acme.com", title: "Customer Service Agent" })], members, roles);
    expect(v.results[0]).toEqual({ status: "unchanged", message: "Already in this job" });
    expect(v.changes[0]).toBeNull();
  });
  it("can move someone to a different job", () => {
    const v = validatePlacements([row({ email: "sherif@acme.com", title: "Customer Service Manager" })], members, roles);
    expect(v.changes[0]).toEqual({ memberId: "m2", roleId: "r-mgr" });
  });
  it("explains each kind of mistake", () => {
    const v = validatePlacements(
      [row({ email: "" }), row({ email: "nope" }), row({ title: "" }), row({ email: "ghost@acme.com" }), row({ title: "Astronaut" }), row({ family: "Sales" })],
      members,
      roles
    );
    expect(v.results.map((r) => r.message)).toEqual([
      "Email is missing",
      "That is not an email address",
      "Job title is missing",
      "No one with this email is in your company",
      "No job with this title in your Job Architecture",
      expect.stringContaining("is in Customer Service, not Sales"),
    ]);
    expect(v.errors).toBe(6);
  });
  it("needs the family when two jobs share a title, and uses it when given", () => {
    const missing = validatePlacements([row({ title: "Team Lead" })], members, roles);
    expect(missing.results[0].message).toContain("add its family");
    const ok = validatePlacements([row({ title: "Team Lead", family: "sales" })], members, roles);
    expect(ok.changes[0]).toEqual({ memberId: "m1", roleId: "r-lead-sales" });
    const wrong = validatePlacements([row({ title: "Team Lead", family: "HR" })], members, roles);
    expect(wrong.results[0].status).toBe("error");
  });
  it("refuses a person listed with two different jobs, and ignores an exact repeat", () => {
    const two = validatePlacements([row(), row({ title: "Customer Service Agent" })], members, roles);
    expect(two.results.map((r) => r.status)).toEqual(["ok", "error"]);
    const twice = validatePlacements([row(), row()], members, roles);
    expect(twice.results.map((r) => r.status)).toEqual(["ok", "unchanged"]);
    expect(twice.changes.filter(Boolean)).toHaveLength(1);
  });
  it("keeps results lined up with the rows", () => {
    const v = validatePlacements([row({ title: "x" }), row(), row({ email: "ghost@acme.com" })], members, roles);
    expect(v.results.map((r) => r.status)).toEqual(["error", "ok", "error"]);
    expect(v.changes.map((c) => c?.memberId ?? null)).toEqual([null, "m1", null]);
  });
});
