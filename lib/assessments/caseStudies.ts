// Situational judgment layer, scaled by career stage, meant to reveal
// thinking/behavior beyond the Likert self-report score — the same gap
// real assessment centers close with in-basket exercises. Two MCQ scenarios
// per assessment (deterministic, pre-scored options, no AI call — cheap and
// consistent) plus one open-ended scenario for career stages where nuanced
// judgment matters most, scored by AI (see scoreOpenCaseStudy.ts).

export type CaseStudyOption = {
  id: string;
  text: string;
  // 0-100, pre-assigned effectiveness of choosing this option — not a
  // "correct answer" in a strict sense, but a defensible judgment call
  // grounded in the competency the scenario targets.
  score: number;
};

export type MCQCaseStudy = {
  id: string;
  type: "mcq";
  scenario: string;
  options: CaseStudyOption[];
};

export type OpenCaseStudy = {
  id: string;
  type: "open";
  scenario: string;
  prompt: string;
};

export type CaseStudy = MCQCaseStudy | OpenCaseStudy;

export type CareerStageTier = "foundational" | "established" | "senior";

const FOUNDATIONAL_STAGES = ["Student", "Job seeker", "Early-career professional"];
const SENIOR_STAGES = ["Manager", "Executive"];

// Foundational-stage participants get the two MCQ scenarios only — faster,
// and the open-ended judgment call adds less signal without workplace
// experience to draw on yet. Established and senior stages get all three;
// senior is where the open-ended scenario adds the most value, but it isn't
// gated further than that — no reason to withhold it from an established
// professional who wants the deeper read.
export function tierForCareerStage(careerStage: string | null): CareerStageTier {
  if (careerStage && FOUNDATIONAL_STAGES.includes(careerStage)) return "foundational";
  if (careerStage && SENIOR_STAGES.includes(careerStage)) return "senior";
  return "established";
}

export function caseStudiesForAssessment(slug: string, careerStage: string | null): CaseStudy[] {
  const all = CASE_STUDIES[slug] ?? [];
  const tier = tierForCareerStage(careerStage);
  if (tier === "foundational") return all.filter((c) => c.type === "mcq");
  return all;
}

export function getCaseStudy(slug: string, caseStudyId: string): CaseStudy | null {
  return (CASE_STUDIES[slug] ?? []).find((c) => c.id === caseStudyId) ?? null;
}

export type CaseStudyAnswer = {
  caseStudyId: string;
  type: "mcq" | "open";
  selectedOptionId?: string;
  optionScore?: number;
  openText?: string;
  aiScore?: number;
  aiInsight?: string;
};

// Synthesizes the case study layer into one short narrative, kept separate
// from the Likert score/band rather than folded into it — this is meant to
// be additional color on thinking/behavior, not a recalculation of the
// self-report result.
export function buildCaseStudyInsight(assessmentName: string, answers: CaseStudyAnswer[]): string | null {
  if (answers.length === 0) return null;

  const mcqScores = answers.filter((a) => a.type === "mcq" && typeof a.optionScore === "number").map((a) => a.optionScore as number);
  const parts: string[] = [];

  if (mcqScores.length > 0) {
    const avg = mcqScores.reduce((a, b) => a + b, 0) / mcqScores.length;
    if (avg >= 80) {
      parts.push(
        `In the ${assessmentName} case studies, your choices consistently matched the most effective response in each scenario — practical judgment that backs up the self-report score.`
      );
    } else if (avg >= 55) {
      parts.push(
        `In the ${assessmentName} case studies, your choices were reasonable but inconsistent — effective in some scenarios, less so in others. Worth noticing which situations trip you up.`
      );
    } else {
      parts.push(
        `In the ${assessmentName} case studies, your choices suggest this competency may show up less reliably in real situations than the self-report score implies — a concrete area to practice, not just rate yourself on.`
      );
    }
  }

  const openInsights = answers.filter((a) => a.type === "open" && a.aiInsight).map((a) => a.aiInsight as string);
  parts.push(...openInsights);

  return parts.join(" ");
}

function mcq(id: string, scenario: string, options: [string, number][]): MCQCaseStudy {
  return {
    id,
    type: "mcq",
    scenario,
    options: options.map(([text, score], i) => ({ id: String.fromCharCode(97 + i), text, score })),
  };
}

function open(id: string, scenario: string, prompt: string): OpenCaseStudy {
  return { id, type: "open", scenario, prompt };
}

export const CASE_STUDIES: Record<string, CaseStudy[]> = {
  leadership: [
    mcq(
      "leadership-mcq-1",
      "A project you're leading is behind schedule. One teammate has quietly been picking up the slack for another who's been underperforming for weeks, but hasn't said anything to you.",
      [
        ["Wait and see if performance improves on its own before intervening.", 25],
        ["Have a private, direct conversation with the underperforming teammate to understand what's going on, then agree on a specific plan.", 95],
        ["Remind the whole team of deadlines in the next meeting without naming anyone.", 45],
      ]
    ),
    mcq(
      "leadership-mcq-2",
      "You disagree with a decision your own manager made and believe it will hurt your team's morale.",
      [
        ["Implement it without comment — it's not your call.", 30],
        ["Voice your specific concerns privately to your manager with a proposed alternative, then support whatever is finally decided.", 95],
        ["Express your disagreement openly to your team so they know it wasn't your idea.", 15],
      ]
    ),
    open(
      "leadership-open-1",
      "Every leader eventually has to make a call that isn't popular.",
      "Describe a real or hypothetical situation where you had to make an unpopular decision you believed was right. What did you do, and how did you handle the reaction from others?"
    ),
  ],
  "ai-literacy": [
    mcq(
      "ai-literacy-mcq-1",
      "An AI tool gives you a polished-looking answer to a work question you need for a client deliverable.",
      [
        ["Use it as-is since it reads well.", 20],
        ["Verify the key facts against a source you trust before using it.", 95],
        ["Rewrite it in your own words without checking the facts.", 40],
      ]
    ),
    mcq(
      "ai-literacy-mcq-2",
      "Your team is deciding whether to adopt a new AI tool for a recurring task.",
      [
        ["Wait for someone else to test it first.", 40],
        ["Run a small pilot yourself on a low-stakes version of the task and share what you learn.", 95],
        ["Adopt it immediately for all use cases since it's new.", 25],
      ]
    ),
    open(
      "ai-literacy-open-1",
      "Working fluency with AI shows up in the judgment calls around using it, not just knowing it exists.",
      "Describe a specific time you used an AI tool for real work. What did it get right, what did you have to fix or verify yourself, and how did you decide when to trust it?"
    ),
  ],
  "digital-skills": [
    mcq(
      "digital-skills-mcq-1",
      "You're handed a new software tool with no formal training and a deadline in two days.",
      [
        ["Ask someone else to do the parts that require the tool.", 20],
        ["Spend an hour exploring it, find one tutorial, and try the real task early to surface problems fast.", 95],
        ["Wait for official training to be scheduled.", 30],
      ]
    ),
    mcq(
      "digital-skills-mcq-2",
      "You notice a repetitive manual task your team does every week that could likely be automated.",
      [
        ["Keep doing it manually since it works.", 25],
        ["Spend some time investigating a simple automation and propose it if it holds up.", 95],
        ["Mention it once in passing and drop it if no one responds.", 45],
      ]
    ),
    open(
      "digital-skills-open-1",
      "New tools show up faster than formal training ever will.",
      "Describe a time you had to learn a new tool or technology quickly for work. What was your approach, and how did you know when you were ready to rely on it?"
    ),
  ],
  "emotional-intelligence": [
    mcq(
      "emotional-intelligence-mcq-1",
      "A colleague snaps at you in a meeting in a way that seems out of character.",
      [
        ["Snap back to match their energy.", 10],
        ["Stay calm in the moment, then check in with them privately afterward.", 95],
        ["Say nothing and quietly avoid them going forward.", 35],
      ]
    ),
    mcq(
      "emotional-intelligence-mcq-2",
      "You're giving feedback to someone who becomes visibly upset partway through.",
      [
        ["Push through and finish delivering all the feedback as planned.", 30],
        ["Pause, acknowledge how they're feeling, and adjust the pace or continue another time.", 95],
        ["Stop immediately and never bring it up again.", 25],
      ]
    ),
    open(
      "emotional-intelligence-open-1",
      "Reading a room often matters more than what's actually said in it.",
      "Describe a situation where you had to read an emotional dynamic that wasn't being said out loud. What did you notice, and how did you respond?"
    ),
  ],
  personality: [
    mcq(
      "personality-mcq-1",
      "You're assigned to a new project with an unusually loose brief and no clear process.",
      [
        ["Feel energized by the openness and start defining your own structure.", 85],
        ["Feel uneasy and ask for more structure before starting.", 60],
        ["Wait for someone else to define the process before doing anything.", 35],
      ]
    ),
    mcq(
      "personality-mcq-2",
      "Plans for a project change suddenly and with little warning.",
      [
        ["Feel frustrated and need time to adjust before re-engaging.", 45],
        ["Adapt quickly and start working within the new plan.", 90],
        ["Push to revert to the original plan.", 30],
      ]
    ),
    open(
      "personality-open-1",
      "Working style isn't right or wrong, but it is worth knowing about yourself.",
      "Describe your natural working style in a fast-changing environment — what energizes you, and what tends to drain you?"
    ),
  ],
  communication: [
    mcq(
      "communication-mcq-1",
      "You need to explain a complex technical issue to a non-technical stakeholder who's under time pressure.",
      [
        ["Give the full technical explanation so nothing is left out.", 30],
        ["Lead with the practical implication, then offer more detail if they want it.", 95],
        ["Simplify so much that key context is lost.", 40],
      ]
    ),
    mcq(
      "communication-mcq-2",
      "You're presenting an idea and get pushback you didn't anticipate.",
      [
        ["Defend your original point without acknowledging the pushback.", 25],
        ["Genuinely engage with the objection, then respond to the substance of it.", 95],
        ["Concede immediately to avoid conflict.", 35],
      ]
    ),
    open(
      "communication-open-1",
      "Explaining something well means adjusting to the listener, not just the content.",
      "Describe a time you had to explain something complicated to someone with very different context than you. How did you adjust your explanation, and how did you know it landed?"
    ),
  ],
  "learning-agility": [
    mcq(
      "learning-agility-mcq-1",
      "You're assigned to a task completely outside your current expertise.",
      [
        ["Ask to be reassigned to something more familiar.", 25],
        ["Take it on, and actively figure out who or what can help you get up to speed fast.", 95],
        ["Do your best without asking for help, to avoid looking unprepared.", 45],
      ]
    ),
    mcq(
      "learning-agility-mcq-2",
      "A project you worked hard on fails to achieve its goal.",
      [
        ["Move on quickly without examining what happened.", 25],
        ["Do a real analysis of what went wrong and change your approach next time.", 95],
        ["Attribute it mostly to factors outside your control.", 35],
      ]
    ),
    open(
      "learning-agility-open-1",
      "How you handle unfamiliar territory is a better signal than what you already know.",
      "Describe a time you had to pick up a new skill or domain quickly. What was your process, and what did you do differently the next time you faced something unfamiliar?"
    ),
  ],
  "strategic-thinking": [
    mcq(
      "strategic-thinking-mcq-1",
      "You're given two competing priorities with limited time for both.",
      [
        ["Split your time evenly between them.", 40],
        ["Assess which has higher long-term leverage, then make a deliberate tradeoff and explain your reasoning.", 95],
        ["Default to whichever was assigned most recently.", 25],
      ]
    ),
    mcq(
      "strategic-thinking-mcq-2",
      "A short-term win is available that would look good immediately but may create problems in 6 months.",
      [
        ["Take the short-term win — long-term is someone else's problem.", 20],
        ["Weigh both explicitly and choose based on genuine long-term impact, even if it's less visible now.", 95],
        ["Avoid deciding and let it resolve itself.", 25],
      ]
    ),
    open(
      "strategic-thinking-open-1",
      "Strategic tradeoffs rarely have a clean answer.",
      "Describe a decision you made that required weighing a short-term benefit against a longer-term consequence. What factors did you weigh, and what did you decide?"
    ),
  ],
  "problem-solving": [
    mcq(
      "problem-solving-mcq-1",
      "You're facing a problem with no obvious solution and a tight deadline.",
      [
        ["Go with the first workable idea to save time.", 35],
        ["Quickly break it into smaller pieces, generate a couple of options, and test the most promising one first.", 95],
        ["Escalate immediately without attempting it yourself.", 30],
      ]
    ),
    mcq(
      "problem-solving-mcq-2",
      "A recurring issue keeps resurfacing despite repeated fixes.",
      [
        ["Keep applying the same fix each time it happens.", 25],
        ["Investigate the underlying root cause instead of the symptom.", 95],
        ["Accept it as just part of how things work.", 20],
      ]
    ),
    open(
      "problem-solving-open-1",
      "The difference between a real fix and a surface fix usually shows up later.",
      "Walk through a genuinely hard problem you solved. How did you break it down, and how did you know you'd found the real cause rather than a surface fix?"
    ),
  ],
  "critical-thinking": [
    mcq(
      "critical-thinking-mcq-1",
      "You read a compelling argument that confirms what you already believed.",
      [
        ["Accept it since it matches your existing view.", 25],
        ["Check the evidence and reasoning before accepting it, same as you would for a claim you disagreed with.", 95],
        ["Share it further without checking, since it feels obviously true.", 15],
      ]
    ),
    mcq(
      "critical-thinking-mcq-2",
      "A team decision was made based on a data point you suspect might be flawed.",
      [
        ["Say nothing since the decision is already made.", 20],
        ["Raise the specific concern and ask for the data to be verified before proceeding further.", 95],
        ["Quietly proceed with your own version instead.", 35],
      ]
    ),
    open(
      "critical-thinking-open-1",
      "Changing your mind under evidence is harder than it sounds.",
      "Describe a time you changed your mind about something important after encountering evidence that contradicted your initial view. What made you reconsider?"
    ),
  ],
  creativity: [
    mcq(
      "creativity-mcq-1",
      "You're stuck on a problem using your usual approach.",
      [
        ["Keep refining the same approach until it works.", 35],
        ["Deliberately look outside your usual field or method for a different angle.", 90],
        ["Move to a different task and hope for inspiration later.", 40],
      ]
    ),
    mcq(
      "creativity-mcq-2",
      "You have an unconventional idea that might not work.",
      [
        ["Keep it to yourself unless you're certain it'll succeed.", 25],
        ["Propose it, clearly framed as an experiment, and see where the discussion goes.", 95],
        ["Wait for someone senior to suggest something similar first.", 20],
      ]
    ),
    open(
      "creativity-open-1",
      "Original ideas usually come from somewhere specific, not out of nowhere.",
      "Describe an original idea you generated that others found unexpected or useful. Where did the idea actually come from?"
    ),
  ],
  "time-management": [
    mcq(
      "time-management-mcq-1",
      "Your day fills up with urgent requests that aren't actually your highest-priority work.",
      [
        ["Handle everything as it arrives, in the order it comes in.", 30],
        ["Protect time for the high-impact work and push back on or reschedule the lower-value urgent requests.", 95],
        ["Focus only on urgent items and let the important work slip.", 20],
      ]
    ),
    mcq(
      "time-management-mcq-2",
      "You're asked to take on an additional task that would compromise an existing deadline.",
      [
        ["Say yes without flagging the conflict.", 25],
        ["Flag the conflict clearly and negotiate what should actually take priority.", 95],
        ["Say no without offering any alternative.", 35],
      ]
    ),
    open(
      "time-management-open-1",
      "A demanding week reveals what someone actually prioritizes, not what they say they prioritize.",
      "Describe how you planned a particularly demanding week. What got prioritized, what got cut or delayed, and why?"
    ),
  ],
  resilience: [
    mcq(
      "resilience-mcq-1",
      "You receive harsh, unexpected criticism of work you were proud of.",
      [
        ["Dismiss the criticism to protect how you feel about the work.", 25],
        ["Sit with it, separate the useful signal from the delivery, and use what's genuinely useful.", 95],
        ["Accept it entirely and lose confidence in the work overall.", 30],
      ]
    ),
    mcq(
      "resilience-mcq-2",
      "A high-pressure period is stretching on longer than expected.",
      [
        ["Push through without changing anything, even as quality slips.", 30],
        ["Use a specific habit or routine to sustain your performance and recognize when you need a break.", 95],
        ["Disengage from the work until the pressure passes.", 25],
      ]
    ),
    open(
      "resilience-open-1",
      "Recovery from a setback says more than the setback itself.",
      "Describe a real setback you experienced at work. How did you recover, and what changed in how you approached things afterward?"
    ),
  ],
  "change-readiness": [
    mcq(
      "change-readiness-mcq-1",
      "Your team's tools or process change with little warning and no clear rationale given.",
      [
        ["Resist and keep using the old way as long as possible.", 20],
        ["Adapt quickly, and ask questions to understand the rationale if it's unclear.", 95],
        ["Comply passively without engaging with the reasoning.", 45],
      ]
    ),
    mcq(
      "change-readiness-mcq-2",
      "A colleague is struggling to adjust to a recent organizational change.",
      [
        ["Let them work through it on their own.", 35],
        ["Proactively help them adjust, sharing what's worked for you.", 95],
        ["Point out that the change was inevitable and they should just accept it.", 20],
      ]
    ),
    open(
      "change-readiness-open-1",
      "The first few weeks of an unwanted change usually show the most.",
      "Describe a significant change at work that you didn't choose. How did you respond in the first few weeks, and how did that response evolve?"
    ),
  ],
  "career-readiness": [
    mcq(
      "career-readiness-mcq-1",
      "You're offered a stretch opportunity outside your comfort zone with real risk of struggling publicly.",
      [
        ["Decline to avoid the risk of visible failure.", 30],
        ["Take it, and be deliberate about closing the specific gaps it will expose.", 95],
        ["Take it without any specific preparation.", 45],
      ]
    ),
    mcq(
      "career-readiness-mcq-2",
      "You realize your current skill set may not support the role you actually want in two years.",
      [
        ["Assume it will work itself out over time.", 20],
        ["Identify the specific gap now and start closing it deliberately.", 95],
        ["Wait until a performance review flags it.", 35],
      ]
    ),
    open(
      "career-readiness-open-1",
      "Intentional career planning starts with naming the actual gap.",
      "Describe where you want to be in your career in a few years, and the single biggest gap standing between where you are now and that goal."
    ),
  ],
  "executive-readiness": [
    mcq(
      "executive-readiness-mcq-1",
      "A decision you need to make will negatively affect one team while benefiting the organization overall.",
      [
        ["Avoid making the call and let it resolve itself.", 20],
        ["Make the call, and communicate the tradeoff and reasoning directly to the affected team.", 95],
        ["Make the call without addressing it with the affected team.", 40],
      ]
    ),
    mcq(
      "executive-readiness-mcq-2",
      "You need buy-in from a peer group you have no formal authority over.",
      [
        ["Escalate to get authority to force the decision.", 30],
        ["Build the case and relationships needed to influence the outcome without formal authority.", 95],
        ["Give up on getting buy-in and act unilaterally within your own scope.", 25],
      ]
    ),
    open(
      "executive-readiness-open-1",
      "Organization-wide impact means competing interests rarely all win.",
      "Describe a decision you made or contributed to that affected people or outcomes beyond your immediate team. How did you weigh the competing interests involved?"
    ),
  ],
};
