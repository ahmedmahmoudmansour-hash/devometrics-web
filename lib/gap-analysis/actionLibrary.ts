import type { CompetencyDimension } from "./dimensions";

export const LEARNING_FORMATS = [
  "Reading & self-study",
  "Research & case studies",
  "Video courses",
  "Short courses & workshops",
  "Professional certifications",
  "Webinars & virtual events",
  "Hands-on projects",
  "Mentorship & coaching",
  "Peer learning",
  "Live cohort classes",
] as const;

export type LearningFormat = (typeof LEARNING_FORMATS)[number];

// General, dimension-agnostic explanation of what each format actually is —
// shown as a hover tooltip on the format picker, since several of these are
// easy to conflate (e.g. a short workshop vs. a multi-week live cohort
// class) without a plain-language distinction in front of you.
export const LEARNING_FORMAT_DESCRIPTIONS: Record<LearningFormat, string> = {
  "Reading & self-study": "Articles, books, or documentation you work through on your own, at your own pace.",
  "Research & case studies": "Real case studies, postmortems, or research pieces — more evidence-driven than general reading.",
  "Video courses": "Structured, pre-recorded video curriculum you watch on your own schedule.",
  "Short courses & workshops": "A brief, intensive session or two — done in a day or a few days, not spread over weeks.",
  "Professional certifications": "A recognized credential you work toward, often with an exam or assessment at the end.",
  "Webinars & virtual events": "A single live or recorded online session — a talk, demo, or panel, not an ongoing program.",
  "Hands-on projects": "Learning by doing — applying a skill directly to a real task or project you already have.",
  "Mentorship & coaching": "One-on-one guidance from someone more experienced than you.",
  "Peer learning": "Learning alongside people at a similar level — no formal instructor, just mutual accountability.",
  "Live cohort classes": "A structured, multi-week program you go through live, together with the same group of people the whole way.",
};

export type Effort = "quick-win" | "sustained";

// Rough pacing per format, used to space milestone target dates out
// realistically instead of dating every milestone the same day.
export const EFFORT_BY_FORMAT: Record<LearningFormat, Effort> = {
  "Reading & self-study": "sustained",
  "Research & case studies": "sustained",
  "Video courses": "quick-win",
  "Short courses & workshops": "quick-win",
  "Professional certifications": "sustained",
  "Webinars & virtual events": "quick-win",
  "Hands-on projects": "sustained",
  "Mentorship & coaching": "quick-win",
  "Peer learning": "sustained",
  "Live cohort classes": "sustained",
};

const WEEKS_BY_EFFORT: Record<Effort, number> = { "quick-win": 1, sustained: 3 };

export function estimatedWeeks(format: LearningFormat): number {
  return WEEKS_BY_EFFORT[EFFORT_BY_FORMAT[format]];
}

type ActionTemplate = { title: string; description: string };

// One concrete, differentiated action per (dimension x learning format).
// This is what makes two people with the same competency gap get different
// plans — the gap is identical, the path to closing it isn't.
const ACTION_LIBRARY: Record<CompetencyDimension, Record<LearningFormat, ActionTemplate>> = {
  "Technical Skills": {
    "Reading & self-study": {
      title: "Weekly technical deep-dive",
      description:
        "Read one authoritative reference or documentation deep-dive relevant to your target role's core stack each week, and write a short summary of what you'd apply on the job.",
    },
    "Research & case studies": {
      title: "Study a real technical case study",
      description:
        "Find a detailed case study or postmortem of a technical project similar to your target role's core stack, and write down two decisions you'd have made differently.",
    },
    "Video courses": {
      title: "Structured course + rebuild",
      description:
        "Complete a structured video course on the specific technical skill your target role demands most, then rebuild one example from it in your own context.",
    },
    "Short courses & workshops": {
      title: "Take a short technical workshop",
      description:
        "Join a short (1-3 day) technical workshop or intensive course focused on the specific skill your target role demands, and apply what you learned to a real task within the week.",
    },
    "Professional certifications": {
      title: "Earn a recognized technical certification",
      description:
        "Work toward one recognized certification in your target role's core stack — many (vendor certs, Google/Meta/freeCodeCamp certificates) are free or low-cost, not just the expensive ones.",
    },
    "Webinars & virtual events": {
      title: "Attend a live technical webinar",
      description:
        "Attend one live or recorded webinar on the specific tool or technique your target role demands most, and note one thing you'd change in your current work.",
    },
    "Hands-on projects": {
      title: "Stretch task from your real backlog",
      description:
        "Pick one real technical task that stretches your weakest technical area and complete it end-to-end before asking for help.",
    },
    "Mentorship & coaching": {
      title: "Technical review from a senior peer",
      description:
        "Find a senior specialist in your target domain and ask for a 30-minute review of your recent work, specifically probing the gap area.",
    },
    "Peer learning": {
      title: "Trade code or work reviews with a peer",
      description:
        "Find a peer at a similar level and trade reviews of a real piece of technical work weekly, each pointing out one gap the other might have missed.",
    },
    "Live cohort classes": {
      title: "Live technical workshop",
      description:
        "Join a live bootcamp or workshop cohort focused on the specific tool or skill your target role requires.",
    },
  },
  Leadership: {
    "Reading & self-study": {
      title: "Weekly leadership case study",
      description:
        "Read one leadership case study per week and write down the single decision you'd have made differently.",
    },
    "Research & case studies": {
      title: "Analyze a real leadership case study",
      description:
        "Read an in-depth leadership case study (not a summary) and map the decision points against how you'd have handled each one.",
    },
    "Video courses": {
      title: "Decision-making under ambiguity",
      description:
        "Watch a leadership-focused course on decision-making under ambiguity, then apply one technique in your next real decision.",
    },
    "Short courses & workshops": {
      title: "Attend a short leadership workshop",
      description:
        "Join a short leadership workshop or intensive (a few sessions, not a multi-week program) and apply one technique from it in your next real leadership moment.",
    },
    "Professional certifications": {
      title: "Pursue a leadership certificate program",
      description:
        "Work toward a recognized leadership certificate — check whether your employer, a local business school, or a free/low-cost provider (many offer financial aid) covers it before assuming it's out of reach.",
    },
    "Webinars & virtual events": {
      title: "Attend a leadership panel or webinar",
      description:
        "Attend a live leadership webinar or panel discussion and write down one question you'd ask if you could.",
    },
    "Hands-on projects": {
      title: "Lead one real initiative",
      description:
        "Volunteer to lead one small, real initiative at work in the next 30 days — even informally — and track what you'd do differently next time.",
    },
    "Mentorship & coaching": {
      title: "Recurring conversation with a leader you respect",
      description:
        "Ask a leader you respect for a recurring 20-minute conversation about how they'd handle situations you're currently facing.",
    },
    "Peer learning": {
      title: "Form a peer leadership pod",
      description:
        "Find two or three peers at a similar level and meet regularly to workshop real leadership situations each of you is facing — no hierarchy, just mutual accountability.",
    },
    "Live cohort classes": {
      title: "Peer leadership circle",
      description:
        "Join a peer leadership circle or cohort-based program where you practice real scenarios and get feedback.",
    },
  },
  "Strategic Thinking": {
    "Reading & self-study": {
      title: "Critique a real strategic plan",
      description:
        "Read your company's or industry's strategic plan or annual report and write a short critique of its priorities.",
    },
    "Research & case studies": {
      title: "Dissect a real strategy case study",
      description:
        "Read a detailed business-strategy case study (not a summary) and identify the tradeoff the company explicitly chose not to pursue.",
    },
    "Video courses": {
      title: "Strategic frameworks course",
      description:
        "Take a course on strategic frameworks (prioritization, tradeoff analysis) and apply one framework to a real decision you're facing.",
    },
    "Short courses & workshops": {
      title: "Take a short strategy workshop",
      description:
        "Join a short strategic-thinking workshop or intensive course and apply one framework from it to a real decision you're facing this week.",
    },
    "Professional certifications": {
      title: "Work toward a strategy or business-analysis certificate",
      description:
        "Look into a recognized strategy, product, or business-analysis certificate — several credible ones are free or offer financial aid, so check before assuming this route is unaffordable.",
    },
    "Webinars & virtual events": {
      title: "Attend a strategy or industry-outlook webinar",
      description:
        "Attend a live webinar on strategic frameworks or your industry's outlook, and apply one idea to a real decision you're facing.",
    },
    "Hands-on projects": {
      title: "Draft your own strategic plan",
      description:
        "Draft a one-page strategic plan for your own function for the next quarter, including tradeoffs you're explicitly choosing not to pursue.",
    },
    "Mentorship & coaching": {
      title: "Learn how senior leaders think about tradeoffs",
      description:
        "Ask someone two levels above you to walk you through how they think about strategic tradeoffs in their role.",
    },
    "Peer learning": {
      title: "Run a peer strategy roundtable",
      description:
        "Get two or three peers together regularly, each bringing one real strategic decision, and get outside perspective before committing.",
    },
    "Live cohort classes": {
      title: "Cross-functional strategy workshop",
      description: "Join a cross-functional strategy workshop or case-based cohort program.",
    },
  },
  Communication: {
    "Reading & self-study": {
      title: "Rewrite your own work using better principles",
      description:
        "Read one strong resource on clear or persuasive writing, then rewrite a recent piece of your own work using its principles.",
    },
    "Research & case studies": {
      title: "Study what actually changed someone's mind",
      description:
        "Find a case study or research piece on persuasion or communication effectiveness, and identify one technique you don't currently use.",
    },
    "Video courses": {
      title: "Presentation skills course",
      description:
        "Take a course on presentation or written communication, then apply it to your next real presentation or document.",
    },
    "Short courses & workshops": {
      title: "Attend a short communication workshop",
      description:
        "Join a short (half-day or few-session) communication or presentation workshop and apply one technique to your next real presentation.",
    },
    "Professional certifications": {
      title: "Earn a communication or facilitation certificate",
      description:
        "Look into a recognized public-speaking or facilitation certificate (Toastmasters' path is genuinely low-cost) rather than assuming this format means an expensive program.",
    },
    "Webinars & virtual events": {
      title: "Attend a live communication or presentation webinar",
      description:
        "Attend a live webinar on communication or presentation skills and apply one technique to your next real presentation.",
    },
    "Hands-on projects": {
      title: "Record and tighten your explanation",
      description:
        "Record yourself explaining a complex topic from your work in under 3 minutes, then watch it back and tighten it.",
    },
    "Mentorship & coaching": {
      title: "Get a strong communicator to review your work",
      description:
        "Ask a strong communicator you know to review your next important message or presentation before you send it.",
    },
    "Peer learning": {
      title: "Practice with a peer feedback partner",
      description:
        "Pair with a peer to review and critique each other's real messages or presentations before they go out, on a recurring basis.",
    },
    "Live cohort classes": {
      title: "Live public speaking practice group",
      description:
        "Join a public speaking or communication practice group for regular live feedback.",
    },
  },
  "AI & Digital Skills": {
    "Reading & self-study": {
      title: "Weekly AI tool deep-dive",
      description:
        "Read documentation or a guide on one AI tool relevant to your field each week, and identify one real task you could apply it to.",
    },
    "Research & case studies": {
      title: "Read a real AI-adoption case study",
      description:
        "Find a case study of how a company or team in your field actually adopted an AI tool, and identify what you'd copy versus what wouldn't fit your context.",
    },
    "Video courses": {
      title: "Hands-on AI tool course",
      description:
        "Complete a hands-on video course on a specific AI tool or digital skill relevant to your target role.",
    },
    "Short courses & workshops": {
      title: "Take a short AI skills workshop",
      description:
        "Join a short, intensive workshop on a specific AI tool or digital skill and apply it to a real task within the week.",
    },
    "Professional certifications": {
      title: "Earn an AI or digital-skills certificate",
      description:
        "Work toward a recognized AI or digital-skills certificate — Google's Career Certificates and similar programs are genuinely free or low-cost, not just the expensive vendor ones.",
    },
    "Webinars & virtual events": {
      title: "Attend a live AI tools webinar",
      description:
        "Attend a live or recorded webinar demoing a specific AI tool relevant to your work, and try the technique yourself within the week.",
    },
    "Hands-on projects": {
      title: "Automate one real task",
      description:
        "Pick one repetitive task in your current work and use an AI tool to automate or accelerate it end-to-end.",
    },
    "Mentorship & coaching": {
      title: "Shadow someone ahead on AI adoption",
      description:
        "Find someone in your org or network who's ahead on AI adoption and ask them to show you their actual workflow.",
    },
    "Peer learning": {
      title: "Swap AI workflows with a peer",
      description:
        "Find a peer also learning AI tools and trade real workflows weekly — what worked, what didn't, what you'd each try next.",
    },
    "Live cohort classes": {
      title: "Live AI-skills workshop",
      description: "Join a live AI-skills workshop or cohort focused on practical application, not just theory.",
    },
  },
  "Critical Thinking": {
    "Reading & self-study": {
      title: "Weekly steelman exercise",
      description:
        "Read one piece of writing you disagree with each week and write the strongest possible counter-argument to your own view. Alternate weeks with a short piece on prioritization or time management — deciding what NOT to do under a deadline is the same reasoning-under-constraint muscle.",
    },
    "Research & case studies": {
      title: "Study a real decision post-mortem",
      description:
        "Read a detailed post-mortem or research piece on a decision that went wrong, and identify the reasoning flaw that caused it — including cases where the flaw was poor prioritization or resource allocation, not just bad logic.",
    },
    "Video courses": {
      title: "Logical reasoning course",
      description:
        "Take a course on logical reasoning or argument evaluation, then apply it to critique a real decision at work. If you're early-career, a course on prioritization frameworks (e.g. Eisenhower matrix, time-blocking) counts just as much — knowing what to work on first is a reasoning skill, not just a habit.",
    },
    "Short courses & workshops": {
      title: "Attend a short decision-making workshop",
      description:
        "Join a short workshop on structured decision-making, critical thinking, or time/resource prioritization, and apply one technique to a real decision or backlog you're facing this week.",
    },
    "Professional certifications": {
      title: "Work toward a decision-analysis or research-methods certificate",
      description:
        "Look into a recognized decision-analysis, research-methods, or project-prioritization certificate — several credible, free options exist through open university platforms.",
    },
    "Webinars & virtual events": {
      title: "Attend a decision-making webinar",
      description:
        "Attend a live webinar on decision-making, cognitive bias, or prioritizing under limited time/resources, then apply one concept to a real decision you're facing.",
    },
    "Hands-on projects": {
      title: "Test your weakest assumption",
      description:
        "Before your next major decision, write down your assumptions explicitly and test the weakest one before committing. If your real gap is more about workload than judgment calls, apply the same rigor to your own task list: rank this week's work by actual impact, not just urgency, and defend the ranking to yourself.",
    },
    "Mentorship & coaching": {
      title: "Get your reasoning pressure-tested",
      description:
        "Ask someone known for rigorous thinking to pressure-test your reasoning on a real decision you're facing — or, if the gap is more about getting pulled in too many directions, ask them how they decide what to say no to.",
    },
    "Peer learning": {
      title: "Pressure-test decisions with a peer",
      description:
        "Find a peer willing to challenge your reasoning and trade real decisions to pressure-test with each other, on a recurring basis. Early-career: this works just as well for comparing how you each triage a busy week.",
    },
    "Live cohort classes": {
      title: "Live case-study or debate group",
      description:
        "Join a debate club, case-study group, or decision-making workshop that forces you to defend positions live.",
    },
  },
  "People Management": {
    "Reading & self-study": {
      title: "Apply one technique from a management book",
      description:
        "Read one people-management book and apply a single technique with your next direct report or team interaction.",
    },
    "Research & case studies": {
      title: "Study a real management case study",
      description:
        "Read a detailed management case study covering a real feedback or performance situation, and identify what you'd have done differently.",
    },
    "Video courses": {
      title: "Feedback and coaching course",
      description:
        "Take a course on feedback or coaching conversations, then use one technique in your next 1:1.",
    },
    "Short courses & workshops": {
      title: "Take a short management workshop",
      description:
        "Join a short workshop on feedback, coaching, or performance conversations and apply one technique in your next 1:1.",
    },
    "Professional certifications": {
      title: "Earn a people-management certificate",
      description:
        "Work toward a recognized management or coaching certificate — check your employer's L&D budget first, since many companies will cover it even when it looks expensive upfront.",
    },
    "Webinars & virtual events": {
      title: "Attend a management skills webinar",
      description:
        "Attend a live webinar on feedback, coaching, or performance conversations, and apply one technique in your next 1:1.",
    },
    "Hands-on projects": {
      title: "Run a structured 1:1",
      description:
        "Run a structured 1:1 or feedback conversation this week using a specific framework, then note what worked and what didn't.",
    },
    "Mentorship & coaching": {
      title: "Debrief a real management conversation",
      description:
        "Ask an experienced manager to sit in on (or debrief afterward) one of your real management conversations.",
    },
    "Peer learning": {
      title: "Join a manager peer support group",
      description:
        "Find two or three fellow managers to meet regularly and workshop real, current management situations — not hypotheticals.",
    },
    "Live cohort classes": {
      title: "Manager peer group",
      description:
        "Join a manager peer group or cohort program where you workshop real management situations with others.",
    },
  },
  "Financial Literacy": {
    "Reading & self-study": {
      title: "Read real financial statements",
      description:
        "Read your company's (or a public company's) financial statements and write down three things you didn't previously understand.",
    },
    "Research & case studies": {
      title: "Study a real financial case study",
      description:
        "Read a case study involving a real budgeting, pricing, or financial-modeling decision, and identify the tradeoff behind it.",
    },
    "Video courses": {
      title: "Business finance fundamentals course",
      description:
        "Take a course on business finance fundamentals (P&L, budgeting, unit economics) relevant to your role.",
    },
    "Short courses & workshops": {
      title: "Attend a short finance workshop",
      description:
        "Join a short business-finance workshop or intensive course and apply one concept to a real number from your own team or project.",
    },
    "Professional certifications": {
      title: "Work toward a finance-for-non-finance certificate",
      description:
        "Look into a recognized finance-for-managers certificate — free or low-cost options exist through open university platforms, not just the expensive institutional ones.",
    },
    "Webinars & virtual events": {
      title: "Attend a business-finance webinar",
      description:
        "Attend a live webinar on business finance fundamentals and apply one concept to a real number from your own team or project.",
    },
    "Hands-on projects": {
      title: "Build a real budget or model",
      description: "Build a simple budget or financial model for a real project or team you're involved with.",
    },
    "Mentorship & coaching": {
      title: "Learn to read financial performance",
      description:
        "Ask someone in finance or a business-savvy leader to walk you through how they read financial performance.",
    },
    "Peer learning": {
      title: "Trade financial-literacy notes with a peer",
      description:
        "Find a peer also building financial literacy and trade what you're each learning weekly, testing it against real numbers from your own work.",
    },
    "Live cohort classes": {
      title: "Finance-for-non-finance workshop",
      description: "Join a finance-for-non-finance-managers workshop or cohort course.",
    },
  },
};

function levelBandPrefix(currentLevel: number): string {
  if (currentLevel <= 40) return "Start with the fundamentals — ";
  if (currentLevel <= 60) return "Build consistency — ";
  if (currentLevel <= 80) return "Sharpen an existing strength — ";
  return "Push into advanced territory — ";
}

export function getActionOptions(
  dimension: CompetencyDimension,
  currentLevel: number
): { format: LearningFormat; title: string; description: string }[] {
  const prefix = levelBandPrefix(currentLevel);
  return LEARNING_FORMATS.map((format) => {
    const template = ACTION_LIBRARY[dimension][format];
    return { format, title: prefix + template.title, description: template.description };
  });
}

// Tries each of the person's stated preferences in the order they picked
// them, so someone who prefers both "Video courses" and "Hands-on projects"
// gets whichever of the two is actually offered for this dimension, ranked
// by their own priority — not just whichever one happens to be first in
// the fixed LEARNING_FORMATS list.
export function getDefaultAction(
  dimension: CompetencyDimension,
  currentLevel: number,
  learningPreferences: string[] | null
) {
  const options = getActionOptions(dimension, currentLevel);
  for (const preference of learningPreferences ?? []) {
    const match = options.find((o) => o.format === preference);
    if (match) return match;
  }
  return options[0];
}
