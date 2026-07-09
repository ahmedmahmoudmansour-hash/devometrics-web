import type { LevelSection } from "@/lib/assessments/catalog";

export type RoleplayScenario = {
  slug: string;
  title: string;
  level: LevelSection;
  // Which assessments this scenario most exercises — used to frame feedback
  // and to link back to the Assessment Center, not a hard gate.
  competencyFocus: string[];
  setup: string;
  yourRole: string;
  openingMessage: string;
};

export const ROLEPLAY_SCENARIOS: RoleplayScenario[] = [
  {
    slug: "missed-deadlines",
    title: "The Missed Deadlines",
    level: "Leadership",
    competencyFocus: ["Leadership", "Coaching & Mentorship"],
    setup:
      "Alex, one of your direct reports, has missed three deadlines this quarter. The work that does land is solid, but the lateness is starting to affect the rest of the team's planning.",
    yourRole: "You are Alex's manager. You've called a 1:1 to address this.",
    openingMessage:
      "*Alex sits down, a little tense.* \"Hey — you wanted to talk? I figured this was coming.\"",
  },
  {
    slug: "team-conflict",
    title: "The Team Conflict",
    level: "Leadership",
    competencyFocus: ["Leadership", "Emotional Intelligence", "Communication"],
    setup:
      "Jordan and Sam, two members of your team, have been in open conflict for weeks — sharp comments in meetings, visible tension, and it's starting to affect the rest of the team's morale.",
    yourRole: "You are their manager. You've pulled them both into a room together.",
    openingMessage:
      "*Jordan and Sam sit on opposite sides of the table, arms crossed, not looking at each other.* Jordan speaks first: \"I'm only here because you asked. I don't think there's anything to talk about.\"",
  },
  {
    slug: "reluctant-delegate",
    title: "The Reluctant Delegate",
    level: "Leadership",
    competencyFocus: ["Delegation & Team Development", "Coaching & Mentorship"],
    setup:
      "You need to hand off a high-visibility project to Priya, a capable but under-confident member of your team who has never led something this visible before.",
    yourRole: "You are Priya's manager, about to offer her the project.",
    openingMessage:
      "*Priya looks surprised when you bring it up.* \"Me? I mean — I could try, but honestly I'm not sure I'm ready for something this visible. What if I mess it up in front of everyone?\"",
  },
  {
    slug: "difficult-feedback",
    title: "The Difficult Feedback Conversation",
    level: "Leadership",
    competencyFocus: ["Coaching & Mentorship", "Communication"],
    setup:
      "Morgan is your strongest individual performer, but has developed a habit of presenting teammates' work as their own in front of leadership. It's starting to erode trust on the team.",
    yourRole: "You are Morgan's manager, sitting down for a candid conversation.",
    openingMessage:
      "*Morgan smiles, upbeat.* \"Hey! Good timing, actually — did you see the numbers from my project last week? Pretty great, right?\"",
  },
  {
    slug: "layoff-conversation",
    title: "The Restructuring Conversation",
    level: "Executive",
    competencyFocus: ["Executive Readiness", "Emotional Intelligence"],
    setup:
      "Due to a restructuring you didn't choose but must now execute, you have to tell a long-tenured, well-liked team member that their role is being eliminated.",
    yourRole: "You are their manager, delivering the news in a private conversation.",
    openingMessage:
      "*Sam walks in, smiling, clearly expecting a normal 1:1.* \"Hey, what's up? You said this was important?\"",
  },
  {
    slug: "stakeholder-pushback",
    title: "The Stakeholder Pushback",
    level: "Professional",
    competencyFocus: ["Communication", "Strategic Thinking"],
    setup:
      "You're presenting a proposal you've worked on for weeks. A senior stakeholder in the room starts pushing back hard, publicly, questioning the core assumptions in front of your peers.",
    yourRole: "You are the presenter, mid-presentation, on the spot.",
    openingMessage:
      "*The stakeholder cuts in before your next slide.* \"Wait, I have to stop you here — I don't think this actually holds up. Have you considered that your whole model might be wrong?\"",
  },
  {
    slug: "underperforming-new-hire",
    title: "The Underperforming New Hire",
    level: "Leadership",
    competencyFocus: ["Coaching & Mentorship", "Leadership"],
    setup:
      "Taylor joined your team 90 days ago and isn't meeting expectations yet. You need to decide, in this conversation, whether to invest in more coaching or start a formal improvement process.",
    yourRole: "You are Taylor's manager, meeting to discuss their 90-day check-in.",
    openingMessage:
      "*Taylor seems nervous.* \"I know the 90-day mark is today. I've been trying really hard — I'm not sure what else you're looking for from me.\"",
  },
  {
    slug: "promotion-ask",
    title: "The Promotion Ask",
    level: "Leadership",
    competencyFocus: ["Career Readiness", "Communication"],
    setup:
      "Casey, a solid but not yet exceptional performer, has just asked you directly for a promotion you don't think they're ready for.",
    yourRole: "You are Casey's manager, responding to the ask in real time.",
    openingMessage:
      "*Casey looks determined.* \"I wanted to ask you directly — I think I'm ready for the senior role. Can we talk about what it would take to make that happen this cycle?\"",
  },
  {
    slug: "job-interview",
    title: "The Job Interview",
    level: "Foundational",
    competencyFocus: ["Career Readiness", "Communication"],
    setup:
      "You've landed an interview for a role you genuinely want. The interviewer is friendly but thorough — expect behavioral questions, follow-ups on your answers, and at least one question you'd rather not be asked.",
    yourRole: "You are the candidate. The interview is starting now.",
    openingMessage:
      "*The interviewer smiles and opens a notebook.* \"Thanks for coming in — I've read your CV, but I'd rather hear it from you. Walk me through your background and what brought you to apply for this role.\"",
  },
  {
    slug: "salary-negotiation",
    title: "The Salary Negotiation",
    level: "Foundational",
    competencyFocus: ["Communication", "Career Readiness"],
    setup:
      "You've received an offer for a role you want, but the salary is about 15% below what you believe the role is worth and below your research on market range. The recruiter has called to close the deal today.",
    yourRole: "You are the candidate, negotiating your own offer on this call.",
    openingMessage:
      "*The recruiter sounds upbeat.* \"Great news — the team loved you and we're ready to move! You've seen the offer in your inbox. We'd love to get your signature today so we can lock in your start date. How are you feeling about it?\"",
  },
  {
    slug: "impossible-deadline",
    title: "The Impossible Deadline",
    level: "Professional",
    competencyFocus: ["Communication", "Strategic Thinking"],
    setup:
      "Your manager has just committed your team to a deadline you know is unrealistic without cutting corners that will cost more later. You've asked for ten minutes to discuss it before the commitment goes out to the client.",
    yourRole: "You are the team member pushing back on your own manager — without torching the relationship.",
    openingMessage:
      "*Your manager looks impatient.* \"I know it's tight, but I already told leadership we could do it. I need you on board here, not raising problems. What did you want to discuss?\"",
  },
  {
    slug: "cross-functional-deadlock",
    title: "The Cross-Functional Deadlock",
    level: "Professional",
    competencyFocus: ["Communication", "Strategic Thinking", "Emotional Intelligence"],
    setup:
      "Your project needs a deliverable from another department whose lead, Riley, keeps deprioritizing it. Riley doesn't report to you, owes you nothing formally, and has their own targets. Your project slips another week every time this stalls.",
    yourRole: "You've asked Riley for 15 minutes to break the deadlock. You have no authority over them — only influence.",
    openingMessage:
      "*Riley joins the call, camera off at first, then on.* \"Look, before you start — I know your project's waiting on us. Everyone's project is waiting on us. Tell me why yours should jump the queue.\"",
  },
  {
    slug: "budget-defense",
    title: "The Budget Defense",
    level: "Executive",
    competencyFocus: ["Executive Readiness", "Strategic Thinking"],
    setup:
      "Cost cuts are coming and every function must justify its budget. The CFO believes your area is overfunded relative to its measurable impact and has proposed a 30% reduction. You have one meeting to change the outcome.",
    yourRole: "You are the function head, defending your budget to a skeptical CFO.",
    openingMessage:
      "*The CFO slides a one-pager across the table.* \"I'll be direct — the numbers say we can take thirty percent out of your area without the business feeling it. Convince me the numbers are wrong.\"",
  },
];

export function getRoleplayScenario(slug: string): RoleplayScenario | null {
  return ROLEPLAY_SCENARIOS.find((s) => s.slug === slug) ?? null;
}
