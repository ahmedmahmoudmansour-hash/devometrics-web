import { describe, expect, it } from "vitest";
import { JOB_BANK } from "@/lib/jobBank";
import { KNOWLEDGE_BANK, getQuestion, knowledgeStats } from "./index";
import { lengthRankShares, missingQuestions, positionShares, validateQuestions } from "./validate";

describe("knowledge question bank: content", () => {
  it("passes every consistency rule", () => {
    expect(validateQuestions(KNOWLEDGE_BANK, JOB_BANK)).toEqual([]);
  });

  it("has a question at every level 2 to 5 for every competency in the job bank", () => {
    expect(missingQuestions(KNOWLEDGE_BANK, JOB_BANK)).toEqual([]);
    const s = knowledgeStats();
    expect(s.competencies).toBe(s.totalCompetencies);
    expect(s.questions).toBe(s.totalCompetencies * 4);
  });

  it("does not give the answer away by the length of the right option", () => {
    // Pure chance is 25% for each rank. Every rank must stay within a band around it, so neither "pick the longest" nor
    // "pick the shortest" is a winning strategy.
    for (const share of lengthRankShares(KNOWLEDGE_BANK)) {
      expect(share).toBeGreaterThan(0.12);
      expect(share).toBeLessThan(0.38);
    }
  });

  it("spreads the correct answer over all four positions as written", () => {
    for (const share of positionShares(KNOWLEDGE_BANK)) {
      expect(share).toBeGreaterThan(0.15);
      expect(share).toBeLessThan(0.35);
    }
  });

  it("finds a question by id", () => {
    expect(getQuestion("hr.recruitment#3")?.competencyKey).toBe("hr.recruitment");
    expect(getQuestion("nope#2")).toBeNull();
  });
});

describe("the validator catches real mistakes", () => {
  const base = () => structuredClone(KNOWLEDGE_BANK);

  it("flags a duplicate question for the same competency and level", () => {
    const b = base();
    b.push(structuredClone(b[0]));
    expect(validateQuestions(b, JOB_BANK).join("|")).toContain("duplicate");
  });

  it("flags two identical options", () => {
    const b = base();
    b[0].options[1] = b[0].options[2];
    expect(validateQuestions(b, JOB_BANK).join("|")).toContain("four different texts");
  });

  it("flags an unknown competency", () => {
    const b = base();
    b[0].competencyKey = "hr.nothing";
    expect(validateQuestions(b, JOB_BANK).join("|")).toContain("unknown competency");
  });

  it("flags 'all of the above'", () => {
    const b = base();
    b[0].options[3] = "All of the above";
    expect(validateQuestions(b, JOB_BANK).join("|")).toContain("all/none of the above");
  });

  it("reports a missing question", () => {
    const b = base().slice(1);
    expect(missingQuestions(b, JOB_BANK).length).toBe(1);
  });
});
