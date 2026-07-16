// A real, objective reasoning test — same "one correct answer per question"
// architecture as English Proficiency, deliberately NOT another self-report
// Likert item. Three domains real assessment centers actually use
// (numerical, verbal, logical reasoning), each renderable in plain text —
// no images, so no visual-spatial abstract-reasoning section, which is the
// one classic cognitive-battery domain that genuinely can't be done well
// without diagrams.
//
// IMPORTANT — this is a self-development tool, not a validated selection
// instrument. Real I-O psychology research (SIOP guidance, EEOC Uniform
// Guidelines) documents that cognitive ability tests show LARGER group
// differences than other valid predictors of job performance (personality,
// structured interviews, biodata) when used for hiring/promotion — and
// that using one for actual selection requires a job analysis and
// published validity evidence this assessment doesn't have. Every surface
// this appears on must say so plainly. See cefrLevelFromScore's sibling
// cognitiveBandFromScore below and the disclaimer text exported here.

export const COGNITIVE_ABILITY_SLUG = "cognitive-ability";

export const COGNITIVE_DISCLAIMER =
  "This is a self-development tool, not a validated employment-selection instrument. Research shows cognitive ability tests can produce larger group differences than other valid predictors of job performance when used for hiring or promotion — this assessment isn't designed, validated, or intended for that purpose, and should never be the sole or primary basis of a hiring, promotion, or compensation decision.";

export type CognitiveDomain = "Numerical Reasoning" | "Verbal Reasoning" | "Logical Reasoning";

export const COGNITIVE_DOMAINS: CognitiveDomain[] = ["Numerical Reasoning", "Verbal Reasoning", "Logical Reasoning"];

export type CognitiveQuestion = {
  id: string;
  domain: CognitiveDomain;
  passage?: string;
  prompt: string;
  options: string[];
  correctIndex: number;
};

// 4 questions per domain (12 total) — original content, workplace-relevant
// scenarios rather than trivia or specialized knowledge (avoids favoring
// people with a particular educational or cultural background, one of the
// standard adverse-impact mitigation practices for this assessment type).
export const COGNITIVE_QUESTIONS: CognitiveQuestion[] = [
  // Numerical Reasoning — data/ratio interpretation, not speed arithmetic
  { id: "num-1", domain: "Numerical Reasoning", prompt: "A product's quarterly revenue grew from $80,000 to $100,000. What was the percentage increase?", options: ["20%", "25%", "15%", "30%"], correctIndex: 1 },
  { id: "num-2", domain: "Numerical Reasoning", prompt: "A team completes 45 tasks in 3 weeks at a steady rate. At the same rate, how many tasks would they complete in 5 weeks?", options: ["60", "75", "90", "65"], correctIndex: 1 },
  { id: "num-3", domain: "Numerical Reasoning", prompt: "A budget of $120,000 is split across three departments in the ratio 2:3:1. How much does the department with the largest share receive?", options: ["$40,000", "$60,000", "$50,000", "$30,000"], correctIndex: 1 },
  { id: "num-4", domain: "Numerical Reasoning", prompt: "Sales were $50,000 in Q1 and dropped by 10% in Q2. What were Q2 sales?", options: ["$40,000", "$45,000", "$48,000", "$55,000"], correctIndex: 1 },

  // Verbal Reasoning — passage-based True / False / Cannot Say, the
  // classic format used across real reasoning batteries (original passage
  // and statements, not reproduced from any licensed test)
  {
    id: "verb-1",
    domain: "Verbal Reasoning",
    passage: "The company's new remote work policy allows employees to work from home up to three days per week, provided their manager approves the schedule in advance. Employees in customer-facing roles are required to be in the office at least four days per week regardless of the policy.",
    prompt: "All employees can work from home up to three days a week.",
    options: ["True", "False", "Cannot say"],
    correctIndex: 1,
  },
  {
    id: "verb-2",
    domain: "Verbal Reasoning",
    passage: "The company's new remote work policy allows employees to work from home up to three days per week, provided their manager approves the schedule in advance. Employees in customer-facing roles are required to be in the office at least four days per week regardless of the policy.",
    prompt: "Manager approval is required before an eligible employee works from home.",
    options: ["True", "False", "Cannot say"],
    correctIndex: 0,
  },
  {
    id: "verb-3",
    domain: "Verbal Reasoning",
    passage: "The company's new remote work policy allows employees to work from home up to three days per week, provided their manager approves the schedule in advance. Employees in customer-facing roles are required to be in the office at least four days per week regardless of the policy.",
    prompt: "The policy was introduced because employees requested more flexibility.",
    options: ["True", "False", "Cannot say"],
    correctIndex: 2,
  },
  {
    id: "verb-4",
    domain: "Verbal Reasoning",
    passage: "The company's new remote work policy allows employees to work from home up to three days per week, provided their manager approves the schedule in advance. Employees in customer-facing roles are required to be in the office at least four days per week regardless of the policy.",
    prompt: "Customer-facing employees must be in the office at least four days a week regardless of the general policy.",
    options: ["True", "False", "Cannot say"],
    correctIndex: 0,
  },

  // Logical Reasoning — sequence completion and valid deduction (including
  // items designed to catch the classic affirming-the-consequent fallacy)
  { id: "log-1", domain: "Logical Reasoning", prompt: "What number comes next in the sequence: 2, 6, 12, 20, 30, ?", options: ["36", "40", "42", "44"], correctIndex: 2 },
  {
    id: "log-2",
    domain: "Logical Reasoning",
    prompt: "All managers at the company attend the annual leadership offsite. Sarah is attending the leadership offsite this year. What can you validly conclude?",
    options: [
      "Sarah is definitely a manager",
      "Sarah may or may not be a manager — attending the offsite doesn't guarantee she's a manager",
      "Sarah is definitely not a manager",
      "Everyone who attends the offsite is a manager",
    ],
    correctIndex: 1,
  },
  { id: "log-3", domain: "Logical Reasoning", prompt: "What letter comes next in the sequence: A, C, F, J, O, ?", options: ["T", "U", "V", "S"], correctIndex: 1 },
  {
    id: "log-4",
    domain: "Logical Reasoning",
    prompt: "If it rains, the outdoor event is cancelled. The outdoor event was NOT cancelled. What can you conclude?",
    options: ["It rained", "It did not rain", "It might have rained", "Cannot be determined"],
    correctIndex: 1,
  },
];

export type ScoreBand = "Developing" | "Proficient" | "Advanced";

const BAND_THRESHOLDS: { min: number; band: ScoreBand }[] = [
  { min: 75, band: "Advanced" },
  { min: 41, band: "Proficient" },
  { min: 0, band: "Developing" },
];

export function cognitiveBandFromScore(score: number): ScoreBand {
  return (BAND_THRESHOLDS.find((t) => score >= t.min) ?? BAND_THRESHOLDS[BAND_THRESHOLDS.length - 1]).band;
}

// Per-domain breakdown from a stored 1/0 answers array (same order as
// COGNITIVE_QUESTIONS) — the more useful report, since real cognitive
// batteries report sub-scores per domain rather than one aggregate number.
export function domainBreakdown(answers: number[]): { domain: CognitiveDomain; correct: number; total: number }[] {
  return COGNITIVE_DOMAINS.map((domain) => {
    const indices = COGNITIVE_QUESTIONS.map((q, i) => (q.domain === domain ? i : -1)).filter((i) => i >= 0);
    const correct = indices.filter((i) => answers[i] === 1).length;
    return { domain, correct, total: indices.length };
  });
}
