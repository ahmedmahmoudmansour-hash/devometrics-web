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

export type EnglishProficiencyQuestion = {
  id: string;
  level: CEFRLevel;
  skill: "grammar" | "vocabulary" | "reading";
  passage?: string;
  prompt: string;
  options: string[];
  // Index into options — never sent to the client separately from the
  // question, but also never trusted from client input: scoring happens
  // server-side against this same source of truth (see actions below).
  correctIndex: number;
};

// 4 questions per CEFR level (24 total), ordered easiest to hardest —
// grammar, vocabulary, and reading comprehension in roughly equal measure.
// This is a fixed-form test, not an adaptive one: everyone sees all 24
// questions regardless of how they're doing, and the level is derived
// afterward from the pattern of correct answers (see cefrLevelFromScore).
export const ENGLISH_PROFICIENCY_QUESTIONS: EnglishProficiencyQuestion[] = [
  // A1
  { id: "a1-g1", level: "A1", skill: "grammar", prompt: "She ___ to school every day.", options: ["go", "goes", "going", "gone"], correctIndex: 1 },
  { id: "a1-g2", level: "A1", skill: "grammar", prompt: "I ___ a doctor.", options: ["am", "is", "are", "be"], correctIndex: 0 },
  { id: "a1-v1", level: "A1", skill: "vocabulary", prompt: "The opposite of \"big\" is ___.", options: ["tall", "small", "wide", "heavy"], correctIndex: 1 },
  { id: "a1-v2", level: "A1", skill: "vocabulary", prompt: "What do you normally use to write?", options: ["a spoon", "a shoe", "a pen", "a cup"], correctIndex: 2 },

  // A2
  { id: "a2-g1", level: "A2", skill: "grammar", prompt: "Yesterday, I ___ to the market.", options: ["go", "went", "goes", "going"], correctIndex: 1 },
  { id: "a2-g2", level: "A2", skill: "grammar", prompt: "There ___ two apples on the table.", options: ["is", "am", "are", "be"], correctIndex: 2 },
  { id: "a2-v1", level: "A2", skill: "vocabulary", prompt: "If it is raining, you should take an ___.", options: ["umbrella", "oven", "engine", "invoice"], correctIndex: 0 },
  {
    id: "a2-r1",
    level: "A2",
    skill: "reading",
    passage: "Tom works at a bakery. He starts work at 6 a.m. and finishes at 2 p.m.",
    prompt: "What time does Tom finish work?",
    options: ["6 a.m.", "8 a.m.", "2 p.m.", "Noon"],
    correctIndex: 2,
  },

  // B1
  { id: "b1-g1", level: "B1", skill: "grammar", prompt: "By the time she arrived, the meeting ___ already started.", options: ["has", "have", "had", "was"], correctIndex: 2 },
  { id: "b1-g2", level: "B1", skill: "grammar", prompt: "If I ___ more time, I would learn another language.", options: ["have", "had", "has", "having"], correctIndex: 1 },
  { id: "b1-v1", level: "B1", skill: "vocabulary", prompt: "The manager asked us to ___ the report before Friday.", options: ["subscribe", "substitute", "submit", "subside"], correctIndex: 2 },
  {
    id: "b1-r1",
    level: "B1",
    skill: "reading",
    passage: "The company announced a new policy allowing employees to work from home two days a week, starting next month.",
    prompt: "According to the passage, when does the new policy start?",
    options: ["Today", "Last month", "This week", "Next month"],
    correctIndex: 3,
  },

  // B2
  { id: "b2-g1", level: "B2", skill: "grammar", prompt: "Despite ___ tired, she finished the project on time.", options: ["being", "be", "been", "to be"], correctIndex: 0 },
  { id: "b2-g2", level: "B2", skill: "grammar", prompt: "The report, ___ was submitted late, contained several errors.", options: ["who", "whose", "which", "what"], correctIndex: 2 },
  { id: "b2-v1", level: "B2", skill: "vocabulary", prompt: "The negotiations were ___ by a sudden disagreement over pricing.", options: ["enhanced", "derailed", "streamlined", "celebrated"], correctIndex: 1 },
  {
    id: "b2-r1",
    level: "B2",
    skill: "reading",
    passage: "Although automation has increased efficiency in many industries, it has also raised concerns about job displacement, prompting calls for retraining programs.",
    prompt: "What concern does the passage mention about automation?",
    options: ["Lower efficiency", "Higher costs", "Job displacement", "Better training"],
    correctIndex: 2,
  },

  // C1
  { id: "c1-g1", level: "C1", skill: "grammar", prompt: "Not only ___ the deadline, but she also exceeded expectations.", options: ["she did meet", "did meet she", "did she meet", "she meets"], correctIndex: 2 },
  { id: "c1-g2", level: "C1", skill: "grammar", prompt: "Had I known about the delay, I ___ differently.", options: ["will plan", "would plan", "would have planned", "had planned"], correctIndex: 2 },
  { id: "c1-v1", level: "C1", skill: "vocabulary", prompt: "His argument, though persuasive, was ultimately ___ by a lack of supporting evidence.", options: ["reinforced", "clarified", "expedited", "undermined"], correctIndex: 3 },
  {
    id: "c1-r1",
    level: "C1",
    skill: "reading",
    passage: "While critics argue that the policy disproportionately benefits large corporations, proponents maintain that its long-term economic gains will eventually trickle down to smaller businesses and workers alike.",
    prompt: "What do proponents of the policy believe?",
    options: ["The policy only helps corporations", "Critics are correct", "Long-term gains will also reach smaller businesses", "The policy has no economic effect"],
    correctIndex: 2,
  },

  // C2
  { id: "c2-g1", level: "C2", skill: "grammar", prompt: "Rarely ___ such a compelling case been made for reform.", options: ["have", "had", "has", "having"], correctIndex: 2 },
  { id: "c2-g2", level: "C2", skill: "grammar", prompt: "Were it not for her intervention, the project ___ collapsed entirely.", options: ["will have", "would", "had", "would have"], correctIndex: 3 },
  { id: "c2-v1", level: "C2", skill: "vocabulary", prompt: "The committee's decision was widely regarded as ___, reversing decades of established precedent.", options: ["predictable", "redundant", "unprecedented", "negligible"], correctIndex: 2 },
  {
    id: "c2-r1",
    level: "C2",
    skill: "reading",
    passage: "The efficacy of the proposed regulatory framework hinges not merely on its theoretical soundness but on the fidelity with which it is implemented across jurisdictions with markedly divergent administrative capacities.",
    prompt: "According to the passage, what does the framework's success depend on?",
    options: ["Only its theoretical design", "The number of jurisdictions involved", "Both its design and consistent implementation across jurisdictions", "Its cost of implementation"],
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
