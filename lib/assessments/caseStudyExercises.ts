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
];

export function getCaseStudyExercise(slug: string): CaseStudyExercise | null {
  return CASE_STUDY_EXERCISES.find((c) => c.slug === slug) ?? null;
}
