// A real, objective reasoning test — same "one correct answer per question"
// architecture as English Proficiency, deliberately NOT another self-report
// Likert item. Three domains real assessment centers actually use
// (numerical, verbal, logical reasoning), each renderable in plain text —
// no images, so no visual-spatial abstract-reasoning section, which is the
// one classic cognitive-battery domain that genuinely can't be done well
// without diagrams.
//
// IMPORTANT — this is guidance for your own development, not a validated
// selection instrument. Real I-O psychology research (SIOP guidance, EEOC
// Uniform Guidelines) documents that cognitive ability tests show LARGER
// group differences than other valid predictors of job performance
// (personality, structured interviews, biodata) when used for hiring or
// promotion — and that using one for actual selection requires a job
// analysis and published validity evidence this assessment doesn't have.
// Every surface this appears on must say so plainly. See
// cefrLevelFromScore's sibling cognitiveBandFromScore below and the
// disclaimer text exported here.

export const COGNITIVE_ABILITY_SLUG = "cognitive-ability";

export const COGNITIVE_DISCLAIMER =
  "This is guidance for your own development — not a validated employment-selection instrument. Research shows cognitive ability tests can produce larger group differences than other valid predictors of job performance when used for hiring or promotion. This assessment isn't designed, validated, or intended for hiring, promotion, or any other personnel decision — use it only to understand your own reasoning strengths, never as the basis for a decision about you or anyone else.";

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

// 18 questions per domain (54 total) — original content, workplace-relevant
// scenarios rather than trivia or specialized knowledge (avoids favoring
// people with a particular educational or cultural background, one of the
// standard adverse-impact mitigation practices for this assessment type).
export const COGNITIVE_QUESTIONS: CognitiveQuestion[] = [
  // ── Numerical Reasoning — data/ratio interpretation, not speed arithmetic
  { id: "num-1", domain: "Numerical Reasoning", prompt: "A product's quarterly revenue grew from $80,000 to $100,000. What was the percentage increase?", options: ["20%", "25%", "15%", "30%"], correctIndex: 1 },
  { id: "num-2", domain: "Numerical Reasoning", prompt: "A team completes 45 tasks in 3 weeks at a steady rate. At the same rate, how many tasks would they complete in 5 weeks?", options: ["60", "75", "90", "65"], correctIndex: 1 },
  { id: "num-3", domain: "Numerical Reasoning", prompt: "A budget of $120,000 is split across three departments in the ratio 2:3:1. How much does the department with the largest share receive?", options: ["$40,000", "$60,000", "$50,000", "$30,000"], correctIndex: 1 },
  { id: "num-4", domain: "Numerical Reasoning", prompt: "Sales were $50,000 in Q1 and dropped by 10% in Q2. What were Q2 sales?", options: ["$40,000", "$45,000", "$48,000", "$55,000"], correctIndex: 1 },
  { id: "num-5", domain: "Numerical Reasoning", prompt: "A company's revenue was $80,000 and expenses were $60,000. What was the profit margin (profit as a percentage of revenue)?", options: ["20%", "25%", "30%", "33%"], correctIndex: 1 },
  { id: "num-6", domain: "Numerical Reasoning", prompt: "A warehouse holds 400 units. If 25% are shipped out, how many units remain?", options: ["250", "275", "300", "325"], correctIndex: 2 },
  { id: "num-7", domain: "Numerical Reasoning", prompt: "An employee's salary increased from $45,000 to $54,000. What was the percentage increase?", options: ["15%", "18%", "20%", "22%"], correctIndex: 2 },
  { id: "num-8", domain: "Numerical Reasoning", prompt: "A marketing budget of $15,000 is split evenly across 5 campaigns. One campaign is cancelled and the budget is redistributed evenly across the remaining 4. How much does each now receive?", options: ["$3,000", "$3,250", "$3,750", "$3,900"], correctIndex: 2 },
  { id: "num-9", domain: "Numerical Reasoning", prompt: "A company's headcount grows from 50 to 65 employees. What is the percentage growth?", options: ["20%", "25%", "30%", "35%"], correctIndex: 2 },
  { id: "num-10", domain: "Numerical Reasoning", prompt: "A product costs $40 to make and sells for $64. What is the markup as a percentage of the cost?", options: ["40%", "50%", "60%", "70%"], correctIndex: 2 },
  { id: "num-11", domain: "Numerical Reasoning", prompt: "Monthly sales over 4 months were $12,000, $15,000, $9,000, and $16,000. What was the average monthly sales figure?", options: ["$12,000", "$12,500", "$13,000", "$13,500"], correctIndex: 2 },
  { id: "num-12", domain: "Numerical Reasoning", prompt: "A project is 60% complete after 9 weeks, progressing at a steady rate. Approximately how many total weeks will the project take?", options: ["12", "13", "15", "18"], correctIndex: 2 },
  { id: "num-13", domain: "Numerical Reasoning", prompt: "Vendor A charges $2,400 for 60 units. Vendor B charges $3,000 for 80 units. Which vendor offers the lower price per unit?", options: ["Vendor A", "Vendor B", "Both are equal", "Cannot be determined"], correctIndex: 1 },
  { id: "num-14", domain: "Numerical Reasoning", prompt: "A team's error rate dropped from 8% to 5% over a quarter. By how many percentage points did it drop?", options: ["1", "2", "3", "5"], correctIndex: 2 },
  { id: "num-15", domain: "Numerical Reasoning", prompt: "A subscription costs $20/month, or $200/year. How much is saved per year by choosing the annual plan?", options: ["$20", "$40", "$60", "$80"], correctIndex: 1 },
  { id: "num-16", domain: "Numerical Reasoning", prompt: "If inflation runs at 4% per year, approximately how much will a $50,000 salary need to be to keep the same purchasing power after one year?", options: ["$50,400", "$51,000", "$52,000", "$54,000"], correctIndex: 2 },
  { id: "num-17", domain: "Numerical Reasoning", prompt: "A department's budget of $200,000 is cut by 15%. What is the new budget?", options: ["$165,000", "$170,000", "$175,000", "$180,000"], correctIndex: 1 },
  { id: "num-18", domain: "Numerical Reasoning", prompt: "A survey of 240 employees found that 3 out of every 8 prefer remote work. How many employees is that?", options: ["80", "90", "100", "120"], correctIndex: 1 },

  // ── Verbal Reasoning — passage-based True / False / Cannot Say, the
  // classic format used across real reasoning batteries (original passages
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
  {
    id: "verb-5",
    domain: "Verbal Reasoning",
    passage: "The company offers an annual performance bonus to all employees who have completed at least six months of continuous service by the end of the fiscal year. The bonus amount is calculated as a percentage of base salary, determined by the employee's individual performance rating and the company's overall financial results for the year. Employees on approved leave for more than three months during the fiscal year are evaluated on a pro-rated basis.",
    prompt: "All employees receive the same bonus amount.",
    options: ["True", "False", "Cannot say"],
    correctIndex: 1,
  },
  {
    id: "verb-6",
    domain: "Verbal Reasoning",
    passage: "The company offers an annual performance bonus to all employees who have completed at least six months of continuous service by the end of the fiscal year. The bonus amount is calculated as a percentage of base salary, determined by the employee's individual performance rating and the company's overall financial results for the year. Employees on approved leave for more than three months during the fiscal year are evaluated on a pro-rated basis.",
    prompt: "An employee must have at least six months of continuous service to qualify for the bonus.",
    options: ["True", "False", "Cannot say"],
    correctIndex: 0,
  },
  {
    id: "verb-7",
    domain: "Verbal Reasoning",
    passage: "The company offers an annual performance bonus to all employees who have completed at least six months of continuous service by the end of the fiscal year. The bonus amount is calculated as a percentage of base salary, determined by the employee's individual performance rating and the company's overall financial results for the year. Employees on approved leave for more than three months during the fiscal year are evaluated on a pro-rated basis.",
    prompt: "The bonus is paid out quarterly.",
    options: ["True", "False", "Cannot say"],
    correctIndex: 2,
  },
  {
    id: "verb-8",
    domain: "Verbal Reasoning",
    passage: "The company offers an annual performance bonus to all employees who have completed at least six months of continuous service by the end of the fiscal year. The bonus amount is calculated as a percentage of base salary, determined by the employee's individual performance rating and the company's overall financial results for the year. Employees on approved leave for more than three months during the fiscal year are evaluated on a pro-rated basis.",
    prompt: "An employee on four months of approved leave during the year would be evaluated on a pro-rated basis.",
    options: ["True", "False", "Cannot say"],
    correctIndex: 0,
  },
  {
    id: "verb-9",
    domain: "Verbal Reasoning",
    passage: "The IT department requires all employees to change their network password every 90 days. Passwords must be at least twelve characters long and include a mix of letters, numbers, and symbols. Employees who fail to update their password before the deadline will have their account temporarily locked until the password is reset with IT's assistance.",
    prompt: "Passwords must be changed every 90 days.",
    options: ["True", "False", "Cannot say"],
    correctIndex: 0,
  },
  {
    id: "verb-10",
    domain: "Verbal Reasoning",
    passage: "The IT department requires all employees to change their network password every 90 days. Passwords must be at least twelve characters long and include a mix of letters, numbers, and symbols. Employees who fail to update their password before the deadline will have their account temporarily locked until the password is reset with IT's assistance.",
    prompt: "A locked account can only be unlocked by the employee themselves.",
    options: ["True", "False", "Cannot say"],
    correctIndex: 1,
  },
  {
    id: "verb-11",
    domain: "Verbal Reasoning",
    passage: "The IT department requires all employees to change their network password every 90 days. Passwords must be at least twelve characters long and include a mix of letters, numbers, and symbols. Employees who fail to update their password before the deadline will have their account temporarily locked until the password is reset with IT's assistance.",
    prompt: "The password policy was introduced after a security breach.",
    options: ["True", "False", "Cannot say"],
    correctIndex: 2,
  },
  {
    id: "verb-12",
    domain: "Verbal Reasoning",
    passage: "The IT department requires all employees to change their network password every 90 days. Passwords must be at least twelve characters long and include a mix of letters, numbers, and symbols. Employees who fail to update their password before the deadline will have their account temporarily locked until the password is reset with IT's assistance.",
    prompt: "A password of ten characters would meet the minimum length requirement.",
    options: ["True", "False", "Cannot say"],
    correctIndex: 1,
  },
  {
    id: "verb-13",
    domain: "Verbal Reasoning",
    passage: "The company's expense reimbursement policy requires employees to submit receipts for any expense over $25 within 30 days of the purchase. Expenses submitted after 30 days require additional written justification and manager approval before they can be processed. Travel expenses are reimbursed at a fixed per-diem rate rather than itemized receipts.",
    prompt: "An expense of $20 requires a receipt under this policy.",
    options: ["True", "False", "Cannot say"],
    correctIndex: 1,
  },
  {
    id: "verb-14",
    domain: "Verbal Reasoning",
    passage: "The company's expense reimbursement policy requires employees to submit receipts for any expense over $25 within 30 days of the purchase. Expenses submitted after 30 days require additional written justification and manager approval before they can be processed. Travel expenses are reimbursed at a fixed per-diem rate rather than itemized receipts.",
    prompt: "An expense submitted 45 days after purchase can still potentially be processed.",
    options: ["True", "False", "Cannot say"],
    correctIndex: 0,
  },
  {
    id: "verb-15",
    domain: "Verbal Reasoning",
    passage: "The company's expense reimbursement policy requires employees to submit receipts for any expense over $25 within 30 days of the purchase. Expenses submitted after 30 days require additional written justification and manager approval before they can be processed. Travel expenses are reimbursed at a fixed per-diem rate rather than itemized receipts.",
    prompt: "Travel expenses are reimbursed based on itemized receipts.",
    options: ["True", "False", "Cannot say"],
    correctIndex: 1,
  },
  {
    id: "verb-16",
    domain: "Verbal Reasoning",
    passage: "The company's expense reimbursement policy requires employees to submit receipts for any expense over $25 within 30 days of the purchase. Expenses submitted after 30 days require additional written justification and manager approval before they can be processed. Travel expenses are reimbursed at a fixed per-diem rate rather than itemized receipts.",
    prompt: "The manager approval requirement was added to reduce fraud.",
    options: ["True", "False", "Cannot say"],
    correctIndex: 2,
  },
  {
    id: "verb-17",
    domain: "Verbal Reasoning",
    passage: "The company's parental leave policy provides 16 weeks of fully paid leave for the primary caregiver and 6 weeks of fully paid leave for the secondary caregiver, regardless of gender. Employees must have completed one year of service to be eligible, and leave must be taken within twelve months of the birth or adoption.",
    prompt: "The amount of leave depends on whether the employee is male or female.",
    options: ["True", "False", "Cannot say"],
    correctIndex: 1,
  },
  {
    id: "verb-18",
    domain: "Verbal Reasoning",
    passage: "The company's parental leave policy provides 16 weeks of fully paid leave for the primary caregiver and 6 weeks of fully paid leave for the secondary caregiver, regardless of gender. Employees must have completed one year of service to be eligible, and leave must be taken within twelve months of the birth or adoption.",
    prompt: "An employee with eight months of service is immediately eligible for parental leave.",
    options: ["True", "False", "Cannot say"],
    correctIndex: 1,
  },

  // ── Logical Reasoning — sequence completion and valid deduction
  // (including items designed to catch the classic affirming-the-consequent
  // fallacy, and valid modus tollens / contrapositive deductions)
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
  { id: "log-5", domain: "Logical Reasoning", prompt: "What number comes next in the sequence: 3, 8, 15, 24, 35, ?", options: ["46", "47", "48", "50"], correctIndex: 2 },
  {
    id: "log-6",
    domain: "Logical Reasoning",
    prompt: "All senior consultants have completed the leadership certification. James has completed the leadership certification. What can you validly conclude?",
    options: [
      "James is definitely a senior consultant",
      "James may or may not be a senior consultant — completing the certification doesn't guarantee it",
      "James is definitely not a senior consultant",
      "Everyone who completes the certification is a senior consultant",
    ],
    correctIndex: 1,
  },
  { id: "log-7", domain: "Logical Reasoning", prompt: "What letter comes next in the sequence: Z, X, U, Q, ?", options: ["K", "L", "M", "N"], correctIndex: 1 },
  {
    id: "log-8",
    domain: "Logical Reasoning",
    prompt: "If the budget is approved, the project starts in January. The project did NOT start in January. What can you conclude?",
    options: ["The budget was approved", "The budget was not approved", "The budget might have been approved", "Cannot be determined"],
    correctIndex: 1,
  },
  {
    id: "log-9",
    domain: "Logical Reasoning",
    prompt: "Every certified auditor has passed the compliance exam. Fatima has passed the compliance exam. What can you validly conclude?",
    options: [
      "Fatima is definitely a certified auditor",
      "Fatima may or may not be a certified auditor — passing the exam doesn't guarantee it",
      "Fatima is definitely not a certified auditor",
      "Everyone who passes the exam is a certified auditor",
    ],
    correctIndex: 1,
  },
  { id: "log-10", domain: "Logical Reasoning", prompt: "What number comes next in the sequence: 1, 4, 9, 16, 25, ?", options: ["30", "32", "34", "36"], correctIndex: 3 },
  {
    id: "log-11",
    domain: "Logical Reasoning",
    prompt: "If a supplier misses a delivery deadline, the production line is delayed. The production line was NOT delayed. What can you conclude?",
    options: ["The supplier missed the deadline", "The supplier did not miss the deadline", "The supplier might have missed the deadline", "Cannot be determined"],
    correctIndex: 1,
  },
  {
    id: "log-12",
    domain: "Logical Reasoning",
    prompt: "No interns are authorized to approve invoices. Sam is authorized to approve invoices. What can you validly conclude?",
    options: ["Sam is definitely an intern", "Sam is not an intern", "Sam might be an intern", "Cannot be determined"],
    correctIndex: 1,
  },
  { id: "log-13", domain: "Logical Reasoning", prompt: "What number comes next in the sequence: 2, 5, 11, 23, 47, ?", options: ["90", "93", "94", "95"], correctIndex: 3 },
  {
    id: "log-14",
    domain: "Logical Reasoning",
    prompt: "All the reports in the archive from before 2020 have been digitized. This report has not been digitized. What can you validly conclude?",
    options: ["The report is from before 2020", "The report is not from before 2020", "The report might be from before 2020", "Cannot be determined"],
    correctIndex: 1,
  },
  { id: "log-15", domain: "Logical Reasoning", prompt: "What letter comes next in the sequence: B, D, G, K, P, ?", options: ["T", "U", "V", "W"], correctIndex: 2 },
  {
    id: "log-16",
    domain: "Logical Reasoning",
    prompt: "If a machine is due for maintenance, it is taken offline for inspection. This machine was NOT taken offline for inspection. What can you conclude?",
    options: ["The machine was due for maintenance", "The machine was not due for maintenance", "The machine might have been due for maintenance", "Cannot be determined"],
    correctIndex: 1,
  },
  { id: "log-17", domain: "Logical Reasoning", prompt: "What number comes next in the sequence: 100, 95, 85, 70, 50, ?", options: ["20", "25", "30", "35"], correctIndex: 1 },
  {
    id: "log-18",
    domain: "Logical Reasoning",
    prompt: "Every valid invoice number begins with the letter 'V'. This number does not begin with the letter 'V'. What can you validly conclude?",
    options: ["It is a valid invoice number", "It is not a valid invoice number", "It might be a valid invoice number", "Cannot be determined"],
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
