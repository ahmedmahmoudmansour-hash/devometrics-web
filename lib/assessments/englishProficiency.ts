// A genuine ability test — objective questions with one correct answer,
// unlike everything else in the catalog (self-report Likert). Deliberately
// kept OUT of ASSESSMENTS/AssessmentForm rather than shoehorned in: that
// component assumes agree/disagree statements with no "correct" answer,
// and forcing this into it would either break scoring or silently turn an
// ability test into a self-rating. Same reasoning that gave the timed
// case-study exercises their own route/table — a different question shape
// gets its own flow, not a bent version of the existing one.
//
// Storage does reuse assessment_results (via the existing
// saveAssessmentResult action) rather than a new table: score is percent
// correct (0-100), answers is 1/0 per question in ENGLISH_PROFICIENCY_QUESTIONS
// order — that's enough to recompute the CEFR breakdown later without a
// schema change, and it means this assessment automatically shows up
// everywhere assessment_results already does (admin employee report, the
// free-tier assessment cap, etc.) with zero extra plumbing.

export const ENGLISH_PROFICIENCY_SLUG = "english-proficiency";

export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export const CEFR_LEVELS: CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export const CEFR_DESCRIPTIONS: Record<CEFRLevel, { label: string; canDo: string }> = {
  A1: { label: "Beginner", canDo: "Understands and uses familiar everyday expressions and very basic phrases for concrete needs." },
  A2: { label: "Elementary", canDo: "Communicates in simple, routine tasks on familiar topics and describes immediate needs in simple terms." },
  B1: { label: "Intermediate", canDo: "Handles most situations likely to arise while traveling or working, and describes experiences and plans." },
  B2: { label: "Upper Intermediate", canDo: "Interacts with fluency and spontaneity, and produces clear, detailed text on a wide range of subjects." },
  C1: { label: "Advanced", canDo: "Uses language flexibly and effectively for social, academic, and professional purposes, including complex topics." },
  C2: { label: "Proficient", canDo: "Understands with ease virtually everything read or heard, and expresses ideas with precision and nuance." },
};

export type EnglishSkill = "grammar" | "vocabulary" | "reading";

export const ENGLISH_SKILLS: EnglishSkill[] = ["grammar", "vocabulary", "reading"];

export type EnglishProficiencyQuestion = {
  id: string;
  level: CEFRLevel;
  skill: EnglishSkill;
  passage?: string;
  prompt: string;
  options: string[];
  // Index into options — never sent to the client separately from the
  // question, but also never trusted from client input: scoring happens
  // server-side against this same source of truth (see actions below).
  correctIndex: number;
};

// 9 questions per CEFR level (54 total) — a uniform 3 grammar + 3
// vocabulary + 3 reading at every level, so the skill breakdown below is
// actually comparable level to level rather than an artifact of whichever
// skill happened to get more items at that band. Ordered easiest to
// hardest — this is a fixed-form test, not an adaptive one: everyone sees
// all 54 questions regardless of how they're doing, and the level is
// derived afterward from the pattern of correct answers (see
// cefrLevelFromScore).
export const ENGLISH_PROFICIENCY_QUESTIONS: EnglishProficiencyQuestion[] = [
  // ── A1 ──────────────────────────────────────────────────────────────
  { id: "a1-g1", level: "A1", skill: "grammar", prompt: "She ___ to school every day.", options: ["go", "goes", "going", "gone"], correctIndex: 1 },
  { id: "a1-g2", level: "A1", skill: "grammar", prompt: "I ___ a doctor.", options: ["am", "is", "are", "be"], correctIndex: 0 },
  { id: "a1-g3", level: "A1", skill: "grammar", prompt: "They ___ from Canada.", options: ["is", "am", "are", "be"], correctIndex: 2 },
  { id: "a1-v1", level: "A1", skill: "vocabulary", prompt: "The opposite of \"big\" is ___.", options: ["tall", "small", "wide", "heavy"], correctIndex: 1 },
  { id: "a1-v2", level: "A1", skill: "vocabulary", prompt: "What do you normally use to write?", options: ["a spoon", "a shoe", "a pen", "a cup"], correctIndex: 2 },
  { id: "a1-v3", level: "A1", skill: "vocabulary", prompt: "The opposite of \"hot\" is ___.", options: ["cold", "warm", "big", "fast"], correctIndex: 0 },
  {
    id: "a1-r1",
    level: "A1",
    skill: "reading",
    passage: "Maria has a red car. She drives to work every morning.",
    prompt: "What color is Maria's car?",
    options: ["Blue", "Red", "Green", "Black"],
    correctIndex: 1,
  },
  {
    id: "a1-r2",
    level: "A1",
    skill: "reading",
    passage: "The store opens at 9 a.m. and closes at 6 p.m.",
    prompt: "What time does the store open?",
    options: ["6 a.m.", "9 a.m.", "9 p.m.", "6 p.m."],
    correctIndex: 1,
  },
  {
    id: "a1-r3",
    level: "A1",
    skill: "reading",
    passage: "Ali has two brothers and one sister.",
    prompt: "How many siblings does Ali have?",
    options: ["One", "Two", "Three", "Four"],
    correctIndex: 2,
  },

  // ── A2 ──────────────────────────────────────────────────────────────
  { id: "a2-g1", level: "A2", skill: "grammar", prompt: "Yesterday, I ___ to the market.", options: ["go", "went", "goes", "going"], correctIndex: 1 },
  { id: "a2-g2", level: "A2", skill: "grammar", prompt: "There ___ two apples on the table.", options: ["is", "am", "are", "be"], correctIndex: 2 },
  { id: "a2-g3", level: "A2", skill: "grammar", prompt: "We ___ to the cinema last night.", options: ["go", "goes", "went", "going"], correctIndex: 2 },
  { id: "a2-v1", level: "A2", skill: "vocabulary", prompt: "If it is raining, you should take an ___.", options: ["umbrella", "oven", "engine", "invoice"], correctIndex: 0 },
  { id: "a2-v2", level: "A2", skill: "vocabulary", prompt: "If you are tired, you should ___.", options: ["rest", "run", "shout", "cook"], correctIndex: 0 },
  { id: "a2-v3", level: "A2", skill: "vocabulary", prompt: "The place where you buy medicine is called a ___.", options: ["bakery", "pharmacy", "library", "garage"], correctIndex: 1 },
  {
    id: "a2-r1",
    level: "A2",
    skill: "reading",
    passage: "Tom works at a bakery. He starts work at 6 a.m. and finishes at 2 p.m.",
    prompt: "What time does Tom finish work?",
    options: ["6 a.m.", "8 a.m.", "2 p.m.", "Noon"],
    correctIndex: 2,
  },
  {
    id: "a2-r2",
    level: "A2",
    skill: "reading",
    passage: "Sara works in an office. She takes the bus to work every day because she does not have a car.",
    prompt: "How does Sara get to work?",
    options: ["By car", "By bus", "By bike", "On foot"],
    correctIndex: 1,
  },
  {
    id: "a2-r3",
    level: "A2",
    skill: "reading",
    passage: "The meeting starts at 10 a.m. Please arrive 10 minutes early.",
    prompt: "What time should you arrive?",
    options: ["9:50 a.m.", "10:00 a.m.", "10:10 a.m.", "9:40 a.m."],
    correctIndex: 0,
  },

  // ── B1 ──────────────────────────────────────────────────────────────
  { id: "b1-g1", level: "B1", skill: "grammar", prompt: "By the time she arrived, the meeting ___ already started.", options: ["has", "have", "had", "was"], correctIndex: 2 },
  { id: "b1-g2", level: "B1", skill: "grammar", prompt: "If I ___ more time, I would learn another language.", options: ["have", "had", "has", "having"], correctIndex: 1 },
  { id: "b1-g3", level: "B1", skill: "grammar", prompt: "By next year, she ___ at the company for a decade.", options: ["will work", "will have worked", "works", "worked"], correctIndex: 1 },
  { id: "b1-v1", level: "B1", skill: "vocabulary", prompt: "The manager asked us to ___ the report before Friday.", options: ["subscribe", "substitute", "submit", "subside"], correctIndex: 2 },
  { id: "b1-v2", level: "B1", skill: "vocabulary", prompt: "The company decided to ___ the launch until next quarter.", options: ["postpone", "accelerate", "celebrate", "ignore"], correctIndex: 0 },
  { id: "b1-v3", level: "B1", skill: "vocabulary", prompt: "He is very ___ about the new project — he thinks it will fail.", options: ["optimistic", "skeptical", "generous", "punctual"], correctIndex: 1 },
  {
    id: "b1-r1",
    level: "B1",
    skill: "reading",
    passage: "The company announced a new policy allowing employees to work from home two days a week, starting next month.",
    prompt: "According to the passage, when does the new policy start?",
    options: ["Today", "Last month", "This week", "Next month"],
    correctIndex: 3,
  },
  {
    id: "b1-r2",
    level: "B1",
    skill: "reading",
    passage: "The training session has been rescheduled from Monday to Wednesday due to a scheduling conflict with the main conference room.",
    prompt: "Why was the training session rescheduled?",
    options: ["The trainer was sick", "A room scheduling conflict", "Low attendance", "Budget cuts"],
    correctIndex: 1,
  },
  {
    id: "b1-r3",
    level: "B1",
    skill: "reading",
    passage: "Employees who complete the certification within six months will receive a bonus. Those who complete it after six months are not eligible.",
    prompt: "What happens if an employee completes the certification in month seven?",
    options: ["They receive a bonus", "They receive half a bonus", "They are not eligible for the bonus", "They must repeat the certification"],
    correctIndex: 2,
  },

  // ── B2 ──────────────────────────────────────────────────────────────
  { id: "b2-g1", level: "B2", skill: "grammar", prompt: "Despite ___ tired, she finished the project on time.", options: ["being", "be", "been", "to be"], correctIndex: 0 },
  { id: "b2-g2", level: "B2", skill: "grammar", prompt: "The report, ___ was submitted late, contained several errors.", options: ["who", "whose", "which", "what"], correctIndex: 2 },
  { id: "b2-g3", level: "B2", skill: "grammar", prompt: "Had the team communicated more clearly, the project ___ delayed.", options: ["would not be", "would not have been", "will not be", "is not"], correctIndex: 1 },
  { id: "b2-v1", level: "B2", skill: "vocabulary", prompt: "The negotiations were ___ by a sudden disagreement over pricing.", options: ["enhanced", "derailed", "streamlined", "celebrated"], correctIndex: 1 },
  { id: "b2-v2", level: "B2", skill: "vocabulary", prompt: "The new policy is intended to ___ inefficiencies across departments.", options: ["amplify", "eliminate", "obscure", "celebrate"], correctIndex: 1 },
  { id: "b2-v3", level: "B2", skill: "vocabulary", prompt: "Her presentation was ___ — clear, concise, and persuasive.", options: ["tedious", "compelling", "redundant", "ambiguous"], correctIndex: 1 },
  {
    id: "b2-r1",
    level: "B2",
    skill: "reading",
    passage: "Although automation has increased efficiency in many industries, it has also raised concerns about job displacement, prompting calls for retraining programs.",
    prompt: "What concern does the passage mention about automation?",
    options: ["Lower efficiency", "Higher costs", "Job displacement", "Better training"],
    correctIndex: 2,
  },
  {
    id: "b2-r2",
    level: "B2",
    skill: "reading",
    passage: "While the merger is expected to reduce operating costs by 15%, analysts caution that integration challenges in the first year could offset much of that savings.",
    prompt: "What concern do analysts raise about the merger?",
    options: ["The cost savings are exaggerated", "Integration challenges could offset savings", "The merger will fail", "Costs will rise by 15%"],
    correctIndex: 1,
  },
  {
    id: "b2-r3",
    level: "B2",
    skill: "reading",
    passage: "The proposal was well received by senior leadership, though several department heads expressed concern about the tight implementation timeline.",
    prompt: "What was the main concern raised by department heads?",
    options: ["The proposal's cost", "The implementation timeline", "Leadership's support", "The proposal's originality"],
    correctIndex: 1,
  },

  // ── C1 ──────────────────────────────────────────────────────────────
  { id: "c1-g1", level: "C1", skill: "grammar", prompt: "Not only ___ the deadline, but she also exceeded expectations.", options: ["she did meet", "did meet she", "did she meet", "she meets"], correctIndex: 2 },
  { id: "c1-g2", level: "C1", skill: "grammar", prompt: "Had I known about the delay, I ___ differently.", options: ["will plan", "would plan", "would have planned", "had planned"], correctIndex: 2 },
  { id: "c1-g3", level: "C1", skill: "grammar", prompt: "So thorough was her analysis ___ no one questioned the conclusion.", options: ["that", "which", "as", "so"], correctIndex: 0 },
  { id: "c1-v1", level: "C1", skill: "vocabulary", prompt: "His argument, though persuasive, was ultimately ___ by a lack of supporting evidence.", options: ["reinforced", "clarified", "expedited", "undermined"], correctIndex: 3 },
  { id: "c1-v2", level: "C1", skill: "vocabulary", prompt: "The board's decision was met with ___ from shareholders who felt excluded from the process.", options: ["enthusiasm", "indifference", "consternation", "gratitude"], correctIndex: 2 },
  { id: "c1-v3", level: "C1", skill: "vocabulary", prompt: "The company's growth strategy remained largely ___ despite significant shifts in the market.", options: ["dynamic", "static", "volatile", "erratic"], correctIndex: 1 },
  {
    id: "c1-r1",
    level: "C1",
    skill: "reading",
    passage: "While critics argue that the policy disproportionately benefits large corporations, proponents maintain that its long-term economic gains will eventually trickle down to smaller businesses and workers alike.",
    prompt: "What do proponents of the policy believe?",
    options: ["The policy only helps corporations", "Critics are correct", "Long-term gains will also reach smaller businesses", "The policy has no economic effect"],
    correctIndex: 2,
  },
  {
    id: "c1-r2",
    level: "C1",
    skill: "reading",
    passage: "Critics of the proposed regulation contend that its compliance costs would disproportionately burden small businesses, while proponents argue that the long-term consumer protections justify the short-term expense.",
    prompt: "What do proponents of the regulation argue?",
    options: ["Compliance costs are too high", "Small businesses will benefit most", "Long-term consumer protections justify the cost", "The regulation should be delayed"],
    correctIndex: 2,
  },
  {
    id: "c1-r3",
    level: "C1",
    skill: "reading",
    passage: "Although the pilot program yielded promising results, the committee was reluctant to scale it company-wide without a longer observation period, citing the risk of drawing conclusions from a limited sample.",
    prompt: "Why was the committee reluctant to scale the program?",
    options: ["The results were poor", "The sample size and observation period were too limited", "The program was too expensive", "Employees disliked the program"],
    correctIndex: 1,
  },

  // ── C2 ──────────────────────────────────────────────────────────────
  { id: "c2-g1", level: "C2", skill: "grammar", prompt: "Rarely ___ such a compelling case been made for reform.", options: ["have", "had", "has", "having"], correctIndex: 2 },
  { id: "c2-g2", level: "C2", skill: "grammar", prompt: "Were it not for her intervention, the project ___ collapsed entirely.", options: ["will have", "would", "had", "would have"], correctIndex: 3 },
  { id: "c2-g3", level: "C2", skill: "grammar", prompt: "Seldom ___ an argument so meticulously constructed.", options: ["has one encountered", "one has encountered", "has encountered one", "one encountered has"], correctIndex: 0 },
  { id: "c2-v1", level: "C2", skill: "vocabulary", prompt: "The committee's decision was widely regarded as ___, reversing decades of established precedent.", options: ["predictable", "redundant", "unprecedented", "negligible"], correctIndex: 2 },
  { id: "c2-v2", level: "C2", skill: "vocabulary", prompt: "The report's findings were largely ___, offering little that hadn't already been established by prior research.", options: ["groundbreaking", "superfluous", "definitive", "contentious"], correctIndex: 1 },
  { id: "c2-v3", level: "C2", skill: "vocabulary", prompt: "His argument, while superficially persuasive, ultimately proved ___ under closer scrutiny.", options: ["robust", "untenable", "coherent", "exhaustive"], correctIndex: 1 },
  {
    id: "c2-r1",
    level: "C2",
    skill: "reading",
    passage: "The efficacy of the proposed regulatory framework hinges not merely on its theoretical soundness but on the fidelity with which it is implemented across jurisdictions with markedly divergent administrative capacities.",
    prompt: "According to the passage, what does the framework's success depend on?",
    options: ["Only its theoretical design", "The number of jurisdictions involved", "Both its design and consistent implementation across jurisdictions", "Its cost of implementation"],
    correctIndex: 2,
  },
  {
    id: "c2-r2",
    level: "C2",
    skill: "reading",
    passage: "The efficacy of the proposed intervention is contingent not solely upon its theoretical merit but upon the fidelity with which it is implemented across contexts that differ markedly in institutional capacity and cultural norms.",
    prompt: "According to the passage, what does the intervention's success depend on?",
    options: ["Only its theoretical merit", "Implementation fidelity across varied contexts", "The size of the institution", "Cultural norms alone"],
    correctIndex: 1,
  },
  {
    id: "c2-r3",
    level: "C2",
    skill: "reading",
    passage: "Notwithstanding the considerable methodological rigor of the study, its conclusions remain provisional, pending replication across a broader and more demographically diverse sample.",
    prompt: "Why are the study's conclusions considered provisional?",
    options: ["The methodology was flawed", "The sample was too large", "Replication across a broader sample is still needed", "The study lacked funding"],
    correctIndex: 2,
  },
];

// Score bands widen toward the middle (B1/B2), matching where most
// test-takers on a fixed-form (non-adaptive) test actually cluster — this
// is an approximation, not a certified CEFR placement, and the result
// screen says so explicitly. Questions run easiest-to-hardest, so overall
// percent correct is a reasonable, honest proxy for level even without
// true adaptive branching.
const CEFR_SCORE_THRESHOLDS: { min: number; level: CEFRLevel }[] = [
  { min: 85, level: "C2" },
  { min: 70, level: "C1" },
  { min: 50, level: "B2" },
  { min: 30, level: "B1" },
  { min: 15, level: "A2" },
  { min: 0, level: "A1" },
];

export function cefrLevelFromScore(score: number): CEFRLevel {
  return (CEFR_SCORE_THRESHOLDS.find((t) => score >= t.min) ?? CEFR_SCORE_THRESHOLDS[CEFR_SCORE_THRESHOLDS.length - 1]).level;
}

// Per-level breakdown from a stored 1/0 answers array (same order as
// ENGLISH_PROFICIENCY_QUESTIONS) — used on the result screen right after
// submission for a "here's exactly where you dropped off" view, richer
// than the single headline level.
export function levelBreakdown(answers: number[]): { level: CEFRLevel; correct: number; total: number }[] {
  return CEFR_LEVELS.map((level) => {
    const indices = ENGLISH_PROFICIENCY_QUESTIONS.map((q, i) => (q.level === level ? i : -1)).filter((i) => i >= 0);
    const correct = indices.filter((i) => answers[i] === 1).length;
    return { level, correct, total: indices.length };
  });
}

// Per-skill breakdown — the orthogonal cut of the same answers array.
// Since every level now has the identical 3/3/3 grammar/vocabulary/reading
// split, this is directly comparable across the whole test (18 questions
// per skill, evenly spread across all six levels) rather than an artifact
// of some levels having more reading items than others.
export function skillBreakdown(answers: number[]): { skill: EnglishSkill; correct: number; total: number }[] {
  return ENGLISH_SKILLS.map((skill) => {
    const indices = ENGLISH_PROFICIENCY_QUESTIONS.map((q, i) => (q.skill === skill ? i : -1)).filter((i) => i >= 0);
    const correct = indices.filter((i) => answers[i] === 1).length;
    return { skill, correct, total: indices.length };
  });
}
