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
];

export function getRoleplayScenario(slug: string): RoleplayScenario | null {
  return ROLEPLAY_SCENARIOS.find((s) => s.slug === slug) ?? null;
}
