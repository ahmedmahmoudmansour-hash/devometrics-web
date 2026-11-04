import { describe, expect, it } from "vitest";
import { JOB_BANK, jobBankStats } from "./index";
import { validateJobBank } from "./validate";

describe("job bank content", () => {
  it("passes every consistency rule", () => {
    expect(validateJobBank(JOB_BANK)).toEqual([]);
  });

  it("covers the requested families and more", () => {
    const names = JOB_BANK.map((f) => f.name);
    for (const wanted of ["Human Resources", "Finance and Accounting", "Information Technology", "Customer Service", "Administration and Office Support", "Operations and Supply Chain", "Engineering"]) {
      expect(names).toContain(wanted);
    }
    expect(JOB_BANK.length).toBeGreaterThanOrEqual(14);
  });

  it("has a useful amount of content", () => {
    const s = jobBankStats();
    expect(s.roles).toBeGreaterThanOrEqual(100);
    expect(s.competencies).toBeGreaterThanOrEqual(80);
  });

  it("every role requires at least one competency at level 3 or above (a role is never all beginner)", () => {
    for (const f of JOB_BANK) for (const r of f.roles) expect(Math.max(...Object.values(r.technical))).toBeGreaterThanOrEqual(2);
  });
});

describe("the validator catches real mistakes", () => {
  const base = () => structuredClone(JOB_BANK);

  it("flags a role that needs a competency the family does not have", () => {
    const b = base();
    b[0].roles[0].technical["hr.nope"] = 3;
    expect(validateJobBank(b).join("|")).toContain("unknown competency hr.nope");
  });

  it("flags an empty level description", () => {
    const b = base();
    b[0].competencies[0].levels[2] = " ";
    expect(validateJobBank(b).join("|")).toContain("level 3 is empty");
  });

  it("flags two levels with the same text", () => {
    const b = base();
    b[0].competencies[0].levels[3] = b[0].competencies[0].levels[2];
    expect(validateJobBank(b).join("|")).toContain("repeats another level");
  });

  it("flags a level text that is too long to be stored", () => {
    const b = base();
    b[0].competencies[0].levels[0] = "x".repeat(401) + ".";
    expect(validateJobBank(b).join("|")).toContain("longer than 400");
  });

  it("flags an entry role that needs an expert level", () => {
    const b = base();
    b[0].roles[0].technical["hr.recruitment"] = 5;
    expect(validateJobBank(b).join("|")).toContain("entry role should not need level 5");
  });

  it("flags a duplicate competency name across families", () => {
    const b = base();
    b[1].competencies[0].name = b[0].competencies[0].name;
    expect(validateJobBank(b).join("|")).toContain("duplicate name across the bank");
  });

  it("flags a competency no role uses", () => {
    const b = base();
    for (const r of b[0].roles) delete r.technical["hr.analytics"];
    expect(validateJobBank(b).join("|")).toContain("no role in the family requires it");
  });
});
