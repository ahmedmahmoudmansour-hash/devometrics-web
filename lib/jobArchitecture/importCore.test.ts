import { describe, expect, it } from "vitest";
import { DEFAULT_FAMILY, MAX_TITLE, keyOf, parseGrade, parseTrack, validateRoleRows, type RolesImportRow } from "./importCore";

const row = (over: Partial<RolesImportRow> = {}): RolesImportRow => ({ family: "Customer Service", title: "Customer Service Manager", level: "Manager", grade: "6", track: "Management", responsibilities: "", ...over });
const none = new Set<string>();

describe("grades", () => {
  it("reads the ways people write a grade", () => {
    for (const [raw, n] of [["5", 5], ["G5", 5], ["g 5", 5], ["Grade 5", 5], ["grade-7", 7], ["10", 10], ["1", 1], ["5.0", 5], [" 3 ", 3]] as const) expect(parseGrade(raw)).toBe(n);
  });
  it("refuses anything that is not a grade from 1 to 10", () => {
    for (const raw of ["", "0", "11", "-1", "five", "5.5", "G", "1e3", "G 11", "abc5"]) expect(parseGrade(raw)).toBeNull();
  });
});

describe("tracks", () => {
  it("defaults a blank track to individual contributor", () => {
    expect(parseTrack("")).toBe("ic");
  });
  it("reads the usual words", () => {
    for (const v of ["IC", "ic", "Individual Contributor", "Specialist"]) expect(parseTrack(v)).toBe("ic");
    for (const v of ["Management", "Manager", "Mgmt", "Leadership"]) expect(parseTrack(v)).toBe("management");
  });
  it("refuses an unknown track", () => {
    expect(parseTrack("wizard")).toBeNull();
  });
});

describe("validating an upload", () => {
  it("accepts a good row and plans a new family", () => {
    const v = validateRoleRows([row()], none, none);
    expect(v).toMatchObject({ ok: 1, duplicates: 0, errors: 0, newFamilies: ["Customer Service"] });
    expect(v.roles[0]).toEqual({ family: "Customer Service", title: "Customer Service Manager", level: "Manager", grade: 6, track: "management", responsibilities: "" });
  });
  it("puts a row with no family in General", () => {
    const v = validateRoleRows([row({ family: "  " })], none, none);
    expect(v.roles[0]?.family).toBe(DEFAULT_FAMILY);
    expect(v.newFamilies).toEqual([DEFAULT_FAMILY]);
  });
  it("does not plan a family the company already has (any capitalisation)", () => {
    const v = validateRoleRows([row({ family: "customer  SERVICE" })], none, new Set(["customer service"]));
    expect(v.newFamilies).toEqual([]);
    expect(v.ok).toBe(1);
  });
  it("skips a role the company already has, ignoring case and extra spaces", () => {
    const v = validateRoleRows([row({ title: "  customer   service manager " })], new Set([keyOf("Customer Service", "Customer Service Manager")]), new Set(["customer service"]));
    expect(v.results[0]).toEqual({ status: "duplicate", message: "Already in your Job Architecture" });
    expect(v.roles[0]).toBeNull();
  });
  it("skips a repeat inside the file, keeping the first", () => {
    const v = validateRoleRows([row(), row({ level: "Lead" })], none, none);
    expect(v.results.map((r) => r.status)).toEqual(["ok", "duplicate"]);
  });
  it("allows the same title in two different families", () => {
    const v = validateRoleRows([row(), row({ family: "Sales" })], none, none);
    expect(v.ok).toBe(2);
    expect(v.newFamilies).toEqual(["Customer Service", "Sales"]);
  });
  it("explains each kind of mistake", () => {
    const v = validateRoleRows(
      [row({ title: "" }), row({ title: "x".repeat(MAX_TITLE + 1) }), row({ grade: "12" }), row({ track: "wizard" }), row({ level: "y".repeat(41) })],
      none,
      none
    );
    expect(v.results.map((r) => r.message)).toEqual([
      "Job title is missing",
      expect.stringContaining("longer than"),
      "Grade must be a number from 1 to 10",
      "Track must be IC (individual contributor) or Management",
      expect.stringContaining("Level is longer"),
    ]);
    expect(v.errors).toBe(5);
    expect(v.roles.every((r) => r === null)).toBe(true);
  });
  it("keeps results lined up with the rows even when some fail", () => {
    const v = validateRoleRows([row({ title: "A" }), row({ grade: "x" }), row({ title: "C" })], none, none);
    expect(v.results.map((r) => r.status)).toEqual(["ok", "error", "ok"]);
    expect(v.roles.map((r) => r?.title ?? null)).toEqual(["A", null, "C"]);
  });
  it("does not let markup or odd characters through as anything but text", () => {
    const v = validateRoleRows([row({ title: "<b>Boss</b>", family: "A&B" })], none, none);
    expect(v.roles[0]?.title).toBe("<b>Boss</b>"); // stored as plain text; the screens escape it when shown
    expect(v.ok).toBe(1);
  });
});
