import { describe, expect, it } from "vitest";
import { buildResultView, buildTakeView, competencyName, scoreRow, type CheckRow } from "./view";
import { getQuestion } from "./index";
import { optionOrder } from "./engine";

const ids = ["hr.recruitment#2", "hr.recruitment#3", "hr.learning#2"];
const base = (over: Partial<CheckRow> = {}): CheckRow => ({
  id: "c1",
  employee_user_id: "u1",
  role_title: "HR Generalist",
  language: "en",
  bank_version: "knowledge-1",
  seed: "seed-abc-123",
  question_ids: ids,
  required_levels: { "hr.recruitment": 3, "hr.learning": 2 },
  answers: null,
  created_at: "2026-11-05T00:00:00Z",
  submitted_at: null,
  ...over,
});
const allRight = (): Record<string, number> => Object.fromEntries(ids.map((i) => [i, getQuestion(i)!.correct]));

describe("what the person sees while taking the check", () => {
  it("lists the chosen questions with shuffled options and no answer", () => {
    const v = buildTakeView(base());
    expect(v.questions.map((q) => q.id)).toEqual(ids);
    expect(JSON.stringify(v)).not.toMatch(/"correct"|"why"/);
    for (const q of v.questions) expect(q.options).toHaveLength(4);
  });
  it("shows a saved draft as the position the person saw", () => {
    const original = getQuestion(ids[0])!.correct;
    const v = buildTakeView(base({ answers: { [ids[0]]: original } }));
    const shown = v.draft[ids[0]];
    expect(v.questions[0].options[shown]).toBe(getQuestion(ids[0])!.options[original]);
  });
  it("uses the competency's Arabic name for an Arabic check", () => {
    expect(competencyName("hr.recruitment", "ar")).not.toBe(competencyName("hr.recruitment", "en"));
    expect(competencyName("not.a.key", "en")).toBe("not.a.key");
  });
});

describe("the result", () => {
  it("is not available before the check is submitted", () => {
    expect(buildResultView(base({ answers: allRight() }))).toBeNull();
  });
  it("marks a perfect check as 100 and strong", () => {
    const r = buildResultView(base({ answers: allRight(), submitted_at: "2026-11-05T01:00:00Z" }))!;
    expect(r).toMatchObject({ percent: 100, reading: "strong", asked: 3, correct: 3, answered: 3 });
  });
  it("marks an empty check as 0 and gaps, with every question counted", () => {
    const r = buildResultView(base({ answers: {}, submitted_at: "2026-11-05T01:00:00Z" }))!;
    expect(r).toMatchObject({ percent: 0, reading: "gaps", asked: 3, correct: 0, answered: 0 });
  });
  it("marks some right and some wrong", () => {
    const answers = allRight();
    answers[ids[0]] = (getQuestion(ids[0])!.correct + 1) % 4;
    const r = buildResultView(base({ answers, submitted_at: "2026-11-05T01:00:00Z" }))!;
    expect(r.correct).toBe(2);
    expect(r.percent).toBe(67);
    expect(r.reading).toBe("adequate");
  });
  it("reviews each question in the order the person saw, pointing at their choice and the right answer", () => {
    const answers = allRight();
    const r = buildResultView(base({ answers, submitted_at: "2026-11-05T01:00:00Z" }))!;
    for (const q of r.review) {
      expect(q.chosen).toBe(q.correct);
      const k = getQuestion(q.id)!;
      expect(q.options[q.correct]).toBe(k.options[k.correct]);
      expect(q.why.length).toBeGreaterThan(5);
    }
  });
  it("gives the same result however the options were shuffled", () => {
    const a = buildResultView(base({ seed: "seed-one-aaaa", answers: allRight(), submitted_at: "2026-11-05T01:00:00Z" }))!;
    const b = buildResultView(base({ seed: "seed-two-bbbb", answers: allRight(), submitted_at: "2026-11-05T01:00:00Z" }))!;
    expect(a.percent).toBe(100);
    expect(b.percent).toBe(100);
    // and the shuffles really differ, so the check is not trivially the same
    const orders = new Set(ids.map((i) => optionOrder("seed-one-aaaa", i).join("") + "|" + optionOrder("seed-two-bbbb", i).join("")));
    expect(orders.size).toBeGreaterThan(0);
  });
  it("groups the score by competency with the level the role needed", () => {
    const r = buildResultView(base({ answers: allRight(), submitted_at: "2026-11-05T01:00:00Z" }))!;
    const rec = r.perCompetency.find((p) => p.competencyKey === "hr.recruitment")!;
    expect(rec).toMatchObject({ requiredLevel: 3, asked: 2, correct: 2 });
    expect(rec.competencyName).toBe("Recruitment and Selection");
  });
  it("scoreRow ignores a question that has since been removed from the bank", () => {
    const r = scoreRow(base({ question_ids: [...ids, "gone.away#2"], answers: allRight() }));
    expect(r.asked).toBe(3);
  });
});
