import type { LevelSection } from "./catalog";
import type { CompetencyDimension } from "@/lib/gap-analysis/dimensions";

// Assessment-centre-style exercises: a detailed business case, a visible
// countdown timer, and a written response — a deliberately different format
// from the quick Likert self-report assessments and their embedded
// two-sentence MCQ scenarios. This is the "in-depth, timed" tier the quick
// assessments don't attempt to be.
export type CaseStudyExercise = {
  slug: string;
  title: string;
  dimension: CompetencyDimension;
  level: LevelSection;
  timeLimitMinutes: number;
  context: string;
  prompt: string;
};

export const CASE_STUDY_EXERCISES: CaseStudyExercise[] = [
  {
    slug: "cross-team-prioritization",
    title: "Cross-Team Prioritization Conflict",
    dimension: "People Management",
    level: "Professional",
    timeLimitMinutes: 15,
    context:
      "You manage a small platform team. Both the Growth team and the Compliance team have urgent requests for your one available senior engineer, Dana, starting Monday. Growth needs Dana for two weeks to ship a checkout change that's projected to add $40K/month in revenue. Compliance needs Dana for the same two weeks to close a data-retention gap flagged in an external audit, with a hard regulatory deadline in three weeks. Both team leads have already escalated to your director, separately, each assuming they'll get Dana. You have one working day before you have to tell both leads your decision.",
    prompt:
      "Write out your decision and how you'd communicate it to both team leads. Be specific: what do you decide, what's your reasoning, and what do you actually say to the team lead who doesn't get Dana?",
  },
  {
    slug: "strategic-resource-allocation",
    title: "Strategic Resource Allocation",
    dimension: "Strategic Thinking",
    level: "Leadership",
    timeLimitMinutes: 20,
    context:
      "You lead a department with a fixed budget for next year, no increase from this year. Three initiatives are competing for the same headcount and budget: (1) a cost-cutting automation project with a clear 18-month payback period, (2) a new product line your CEO has publicly committed to at a recent investor call but which internal data suggests has uncertain demand, and (3) a technical-debt reduction effort your senior engineers say is becoming a retention risk if ignored much longer. You can fully fund at most two of the three at the level each team says they need; partially funding all three risks under-delivering on everything.",
    prompt:
      "Decide how you'd allocate the budget across the three initiatives, and write the rationale you'd present to your leadership team. Name what you're explicitly choosing not to fund (or fund less), and why.",
  },
  {
    slug: "underperforming-product-line",
    title: "The Underperforming Product Line",
    dimension: "Financial Literacy",
    level: "Executive",
    timeLimitMinutes: 25,
    context:
      "One of your company's three product lines has missed revenue targets for four consecutive quarters and now operates at roughly break-even. It still has a loyal (if shrinking) customer base and represents 15% of total company revenue. Sunsetting it would free up engineering and support headcount for the two growing product lines, but would mean laying off the ~20-person team dedicated to it, and the product's customers have no equivalent alternative from a competitor. The board has asked you, as the executive owner, for a recommendation at next week's meeting.",
    prompt:
      "Write the recommendation you'd bring to the board: what you'd do with the product line, the financial and people tradeoffs you weighed, and how you'd frame the decision to the team whose roles are affected either way.",
  },
  {
    slug: "market-shift-response",
    title: "Responding to a Sudden Market Shift",
    dimension: "Critical Thinking",
    level: "Executive",
    timeLimitMinutes: 25,
    context:
      "Your company's core product has held a stable 30% market share for the past three years. Six weeks ago, a well-funded competitor launched a stripped-down version of your product at 40% of your price, and early data shows it's pulling your price-sensitive customers. At the same time, your two most senior product engineers are pushing you to shift the roadmap toward a premium AI feature set that could open a new high-margin segment your board has been asking about for a year. Customer support is separately reporting a rise in churn complaints that trace back to onboarding friction, unrelated to either issue. You have a strategy off-site with the executive team in five days and are expected to walk in with one coherent point of view that ties these three threads together, not three separate reactions.",
    prompt:
      "Write the point of view you'd bring to the off-site: how do you read what's actually happening across these three signals together, what's your response, and what would you deliberately choose not to chase right now?",
  },
  {
    slug: "leadership-succession-decision",
    title: "The Leadership Succession Decision",
    dimension: "Leadership",
    level: "Leadership",
    timeLimitMinutes: 20,
    context:
      "A team-lead role has opened up on your team. Two internal people want it. Priya has been with the company five years, is deeply trusted by the team, and kept things stable through two reorganizations — but her own manager has quietly told you her output has plateaued and she seems reluctant to make hard calls. Omar joined 14 months ago, is technically the strongest person on the team, and has been vocal about wanting to lead, but he's clashed with two peers over decisions they felt he made unilaterally. The team already knows a decision is coming, and morale is sensitive to how it lands. You need to decide and tell both of them this week.",
    prompt:
      'Decide who gets the role, and write out your reasoning. Then write what you\'d actually say to the candidate who doesn\'t get it — be specific, not just "keep it constructive."',
  },
  {
    slug: "driving-growth-flat-budget",
    title: "Driving Growth on a Flat Budget",
    dimension: "Strategic Thinking",
    level: "Professional",
    timeLimitMinutes: 18,
    context:
      "You've been asked to grow your business unit's revenue by 20% next year with no increase to headcount or budget. You have three levers available: raising prices on your most loyal customer segment (low risk of churn, uncertain ceiling), pushing harder into a new customer segment your sales team has only lightly tested (higher potential, unproven), or cutting a low-margin product line to free up capacity for the other two (frees resources but takes a near-term revenue hit). Leadership wants your plan in two weeks, and whichever lever you don't pick, someone will ask why.",
    prompt:
      "Write the growth plan you'd bring to leadership: which lever(s) you'd pull, in what order, and how you'd defend the ones you chose not to.",
  },
];

export function getCaseStudyExercise(slug: string): CaseStudyExercise | null {
  return CASE_STUDY_EXERCISES.find((c) => c.slug === slug) ?? null;
}

// t must come from useTranslations("caseStudyExercises") /
// getTranslations("caseStudyExercises"). Only overrides the display-facing
// fields (title/context/prompt) — slug/dimension/level/timeLimitMinutes stay
// as-is since they're stable identifiers, not display text. The raw English
// exercise (from getCaseStudyExercise) is still what's sent to
// scoreCaseStudyExercise for AI scoring, same "translate for display only"
// split used by localizeScenario for roleplay.
export function localizeCaseStudyExercise(
  exercise: CaseStudyExercise,
  t: (key: string) => string
): CaseStudyExercise {
  return {
    ...exercise,
    title: t(`${exercise.slug}.title`),
    context: t(`${exercise.slug}.context`),
    prompt: t(`${exercise.slug}.prompt`),
  };
}
