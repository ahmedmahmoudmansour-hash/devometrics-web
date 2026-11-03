// Opt-in: makes real model calls (a few cents). Run with RUN_AI_TESTS=1 npm run test:live
import { describe, expect, it } from "vitest";
import { generateQuestions, scoreCompetency } from "@/lib/assessment/ai";
import { standardDefinitionText } from "@/lib/assessment/definitions";

const run = process.env.RUN_AI_TESTS === "1";
const d = run ? describe : describe.skip;

const def = {
  name: "Equipment Maintenance",
  description: "Keeps production equipment reliable through diagnosis, repair and preventive maintenance.",
  levels: {
    "1": "Knows the main parts of the equipment and follows the maintenance checklist with supervision.",
    "2": "Carries out routine inspections and simple repairs, and reports faults accurately.",
    "3": "Diagnoses common failures independently, repairs to standard and keeps maintenance records.",
    "4": "Finds root causes of repeat failures, plans preventive maintenance and trains others.",
    "5": "Sets the maintenance strategy for the plant, balances risk against downtime and cost, and drives reliability improvements.",
  },
};
const questions = [
  "A pump trips twice a week with no alarm. What do you check first, and why?",
  "How do you decide between repairing a fault now and planning a shutdown?",
  "How would you set up preventive maintenance for a new compressor line?",
];
const strong = [
  "A trip with no alarm points to a protection or process condition rather than a hard fault, so I would first pull the trip history and compare the trip times with the process data to see if it follows a pattern such as start-ups, level or temperature. Then I would check the overload and thermal settings against the motor rating, measure current and insulation, and inspect the suction side for cavitation and the seal. I would isolate one variable at a time, record the findings, and decide whether the root cause is a setting, a process change or wear. Because it repeats, I would run a root cause analysis and add the fix to the preventive plan.",
  "I treat it as a risk decision. I estimate the failure consequence for safety and output, the likelihood of failure before the next planned stop, and the cost of an extra shutdown compared with a forced one. If I can safely run with monitoring and a tripwire such as vibration or temperature limits, I defer and add it to the next shutdown scope with parts ordered. If the risk of a secondary failure or safety event is not acceptable, I stop now. I document the decision with the reasoning and review the criteria afterwards so the decision rule improves.",
  "I would start from criticality: what happens if each component fails, then set condition checks for the high-risk parts such as vibration, temperature and oil analysis, and time-based tasks for the rest. I would use the maker's data as a start and adjust with failure history. I would define spares, skills and who does what, set measures such as planned work percentage and mean time between failures, and review after three months. I would train the operators on first-line checks so problems are seen early.",
];
const buzz = [
  "I would apply a holistic reliability-centred methodology leveraging best-practice asset management to optimise uptime across the value stream.",
  "I would take a risk-based, data-driven approach that aligns maintenance strategy with operational excellence and continuous improvement.",
  "I would implement a world-class, predictive maintenance paradigm to maximise asset performance and deliver sustainable results.",
];
const thin = ["Look at the pump.", "Fix it now.", "Follow the manual."];

d("assessment engine AI steps (real model calls)", () => {
  it("writes questions in English and in Arabic that pass the checks", async () => {
    const en = await generateQuestions({ definition: def, style: "scenario", requiredBand: 3, roleTitle: "Maintenance Engineer", language: "en", count: 3 });
    expect(en.prompts).toHaveLength(3);
    const ar = await generateQuestions({ definition: standardDefinitionText("Communication", "ar"), style: "situational", requiredBand: 3, roleTitle: "منسق فريق", language: "ar", count: 3 });
    expect(ar.prompts).toHaveLength(3);
    expect(/[\u0600-\u06FF]/.test(ar.prompts[0])).toBe(true);
  }, 120000);

  it("scores a strong answer set at a high level with verified evidence", async () => {
    const r = await scoreCompetency({ definition: def, type: "technical", roleTitle: "Maintenance Engineer", language: "en", questions, answers: strong });
    expect(r.result.status).toBe("scored");
    if (r.result.status === "scored") {
      expect(r.result.level).toBeGreaterThanOrEqual(3);
      expect(r.quotes.length).toBeGreaterThan(0);
      expect(r.confidence).not.toBeNull();
    }
    expect(r.usages.length).toBe(2); // two judgements
  }, 180000);

  it("never scores fluent answers with no substance, or one-line answers", async () => {
    const a = await scoreCompetency({ definition: def, type: "technical", roleTitle: "Maintenance Engineer", language: "en", questions, answers: buzz });
    expect(a.result.status).toBe("not_assessed");
    const b = await scoreCompetency({ definition: def, type: "technical", roleTitle: "Maintenance Engineer", language: "en", questions, answers: thin });
    expect(b.result.status).toBe("not_assessed");
    expect(b.usages.length).toBe(0); // too few answers: no AI call at all
  }, 180000);
});
