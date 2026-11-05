import { describe, expect, it } from "vitest";
import { JOB_BANK } from "@/lib/jobBank";
import { KNOWLEDGE_BANK, getQuestion, knowledgeStats } from "./index";
import { AR_QUESTIONS } from "./ar";
import { lengthRankShares, missingQuestions, positionShares, validateQuestions, validateTranslations } from "./validate";

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

describe("Arabic wording of the questions", () => {
  const ARABIC = new RegExp("[" + String.fromCharCode(0x0600) + "-" + String.fromCharCode(0x06ff) + "]");
  // Latin terms that are normally written as they are in Arabic business text.
  const ALLOWED = new RegExp("(SEO|OEE|5S|DevOps|FIFO|SMART|A/B|AI|SOP|CV|HR|IT|KPI|ROI|PR|SQL|CRM|ERP|ISO|SLA|Lock-out/Tag-out|SUM|[A-Z][0-9]+|=)", "g");
  const translated = KNOWLEDGE_BANK.filter((k) => AR_QUESTIONS[`${k.competencyKey}#${k.level}`]);

  it("has Arabic for every question", () => {
    expect(validateTranslations(KNOWLEDGE_BANK, AR_QUESTIONS)).toEqual([]);
    expect(translated.length).toBe(KNOWLEDGE_BANK.length);
  });

  it("is written in Arabic with no stray English", () => {
    const bad: string[] = [];
    for (const [id, t] of Object.entries(AR_QUESTIONS)) {
      for (const [where, s] of [["stem", t.stem], ["why", t.why], ...t.options.map((o, i) => [`option ${i + 1}`, o])] as [string, string][]) {
        if (!ARABIC.test(s)) bad.push(`${id} ${where}: no Arabic`);
        if (/[A-Za-z]/.test(s.replace(ALLOWED, ""))) bad.push(`${id} ${where}: stray Latin letters: ${s}`);
      }
      if (!/[؟?.]$/.test(t.stem.trim())) bad.push(`${id}: stem should end with a question mark or full stop`);
      if (/(كل ما سبق|جميع ما سبق|لا شيء مما سبق)/.test(t.options.join(" "))) bad.push(`${id}: no "all/none of the above"`);
    }
    expect(bad).toEqual([]);
  });

  it("does not give the answer away by the length of the right option, as in English", () => {
    const rows = KNOWLEDGE_BANK.map((k) => ({ ...k, options: AR_QUESTIONS[`${k.competencyKey}#${k.level}`].options }));
    for (const share of lengthRankShares(rows)) {
      expect(share).toBeGreaterThan(0.1);
      expect(share).toBeLessThan(0.42);
    }
  });
});
