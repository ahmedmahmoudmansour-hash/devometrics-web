import { describe, expect, it } from "vitest";
import { AR_BANK } from "@/lib/jobBank/ar";
import { JOB_BANK } from "@/lib/jobBank";
import { KNOWLEDGE_BANK, getQuestion, isAvailable, questionText } from "./index";
import { bankKeyForName, optionOrder, originalIndex, presentQuestion, readPercent, scoreCheck, selectQuestions } from "./engine";
import { questionId } from "./types";

const all = () => true;
const keyOf = (id: string) => {
  const k = getQuestion(id);
  return k ? { competencyKey: k.competencyKey, correct: k.correct } : null;
};

describe("matching a company's competency to the bank", () => {
  it("matches English and Arabic names, ignoring case and spacing", () => {
    expect(bankKeyForName("Recruitment and Selection")).toBe("hr.recruitment");
    expect(bankKeyForName("  recruitment   and selection ")).toBe("hr.recruitment");
    expect(bankKeyForName(AR_BANK.hr.competencies["hr.recruitment"].name)).toBe("hr.recruitment");
  });
  it("returns null for a name the bank does not know", () => {
    expect(bankKeyForName("Underwater Basket Weaving")).toBeNull();
  });
  it("matches every competency in the job bank by its English name", () => {
    for (const f of JOB_BANK) for (const c of f.competencies) expect(bankKeyForName(c.name)).toBe(c.key);
  });
});

describe("choosing questions", () => {
  it("asks levels 2 up to the level the role needs, never more", () => {
    const r = selectQuestions([{ competencyKey: "hr.recruitment", level: 4 }], all);
    expect(r.ids).toEqual(["hr.recruitment#2", "hr.recruitment#3", "hr.recruitment#4"]);
    expect(r.chosen[0]).toEqual({ competencyKey: "hr.recruitment", requiredLevel: 4, count: 3 });
  });
  it("always asks at least the level-2 question, even for a role that needs level 1", () => {
    expect(selectQuestions([{ competencyKey: "hr.recruitment", level: 1 }], all).ids).toEqual(["hr.recruitment#2"]);
  });
  it("never goes above level 5", () => {
    expect(selectQuestions([{ competencyKey: "hr.recruitment", level: 9 }], all).ids).toHaveLength(4);
  });
  it("ignores a competency the bank has no question for", () => {
    expect(selectQuestions([{ competencyKey: "nope.nothing", level: 3 }], (id) => isAvailable(id, "en")).ids).toEqual([]);
  });
  it("uses each competency once, even if listed twice", () => {
    const r = selectQuestions([{ competencyKey: "hr.analytics", level: 3 }, { competencyKey: "hr.analytics", level: 5 }], all);
    expect(r.ids.filter((i) => i.startsWith("hr.analytics#"))).toHaveLength(2);
  });
  it("drops whole competencies, lowest required level first, when over the cap", () => {
    const reqs = [
      { competencyKey: "hr.recruitment", level: 5 },
      { competencyKey: "hr.learning", level: 5 },
      { competencyKey: "hr.analytics", level: 2 },
    ];
    const r = selectQuestions(reqs, all, 8);
    expect(r.ids).toHaveLength(8); // two competencies of four; the level-2 one does not fit
    expect(r.leftOut).toEqual(["hr.analytics"]);
    expect(new Set(r.ids.map((i) => i.split("#")[0]))).toEqual(new Set(["hr.recruitment", "hr.learning"]));
  });
  it("skips questions that are not available in the language", () => {
    const r = selectQuestions([{ competencyKey: "hr.recruitment", level: 5 }], (id) => id !== "hr.recruitment#3");
    expect(r.ids).toEqual(["hr.recruitment#2", "hr.recruitment#4", "hr.recruitment#5"]);
  });
});

describe("showing questions", () => {
  const id = "hr.recruitment#3";
  it("shuffles the options the same way every time for the same seed", () => {
    expect(optionOrder("seed-1", id)).toEqual(optionOrder("seed-1", id));
  });
  it("is a permutation of the four options", () => {
    for (let i = 0; i < 50; i++) expect([...optionOrder(`s${i}`, id)].sort()).toEqual([0, 1, 2, 3]);
  });
  it("differs between seeds, so one person's letters do not help another", () => {
    const orders = new Set<string>();
    for (let i = 0; i < 60; i++) orders.add(optionOrder(`seed-${i}`, id).join(""));
    expect(orders.size).toBeGreaterThan(8);
  });
  it("shows the options of the question and never the answer", () => {
    const text = questionText(id, "en")!;
    const p = presentQuestion(id, text, "hr.recruitment", "abc");
    expect([...p.options].sort()).toEqual([...text.options].sort());
    expect(JSON.stringify(p)).not.toContain("correct");
    expect(JSON.stringify(p)).not.toContain(text.why);
  });
  it("maps a displayed choice back to the original option, so shuffling never changes the mark", () => {
    const k = getQuestion(id)!;
    const text = questionText(id, "en")!;
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const p = presentQuestion(id, text, k.competencyKey, seed);
      const displayedCorrect = p.options.indexOf(text.options[k.correct]);
      expect(originalIndex(seed, id, displayedCorrect)).toBe(k.correct);
    }
  });
  it("rejects a choice outside 0 to 3", () => {
    expect(originalIndex("a", id, 4)).toBeNull();
    expect(originalIndex("a", id, -1)).toBeNull();
    expect(originalIndex("a", id, 1.5)).toBeNull();
  });
});

describe("marking", () => {
  const ids = ["hr.recruitment#2", "hr.recruitment#3", "hr.learning#2"];
  const right = Object.fromEntries(ids.map((i) => [i, getQuestion(i)!.correct]));

  it("scores all correct as 100", () => {
    const r = scoreCheck(ids, right, keyOf, { "hr.recruitment": 3, "hr.learning": 2 });
    expect(r).toMatchObject({ asked: 3, answered: 3, correct: 3, percent: 100 });
  });
  it("counts an unanswered question as wrong", () => {
    const r = scoreCheck(ids, { ...right, "hr.learning#2": null }, keyOf, {});
    expect(r).toMatchObject({ asked: 3, answered: 2, correct: 2, percent: 67 });
  });
  it("counts a wrong answer as wrong", () => {
    const wrong = (getQuestion(ids[0])!.correct + 1) % 4;
    const r = scoreCheck(ids, { ...right, [ids[0]]: wrong }, keyOf, {});
    expect(r.correct).toBe(2);
  });
  it("breaks the result down by competency with the level required", () => {
    const r = scoreCheck(ids, right, keyOf, { "hr.recruitment": 3, "hr.learning": 2 });
    const rec = r.perCompetency.find((p) => p.competencyKey === "hr.recruitment")!;
    expect(rec).toEqual({ competencyKey: "hr.recruitment", requiredLevel: 3, asked: 2, correct: 2 });
  });
  it("leaves a question that no longer exists out of the count instead of marking it wrong", () => {
    const r = scoreCheck([...ids, "gone.away#2"], right, keyOf, {});
    expect(r.asked).toBe(3);
    expect(r.percent).toBe(100);
  });
  it("scores zero questions as zero, not an error", () => {
    expect(scoreCheck([], {}, keyOf, {})).toMatchObject({ asked: 0, percent: 0 });
  });
  it("reads a percentage in three plain bands", () => {
    expect(readPercent(80)).toBe("strong");
    expect(readPercent(79)).toBe("adequate");
    expect(readPercent(60)).toBe("adequate");
    expect(readPercent(59)).toBe("gaps");
  });
});

describe("the whole bank", () => {
  it("every question has English wording through questionText", () => {
    for (const k of KNOWLEDGE_BANK) expect(isAvailable(questionId(k.competencyKey, k.level), "en")).toBe(true);
  });
});
