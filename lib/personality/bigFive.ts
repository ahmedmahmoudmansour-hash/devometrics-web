// Big Five (OCEAN) — the open, academically standard personality model.
// Deliberately not MBTI or FIRO-B: both are trademarked instruments owned by
// The Myers-Briggs Company, and MBTI in particular has weak test-retest
// reliability. This is a short, original item set (not reproduced from any
// licensed inventory) scored against the same five factors.
export const BIG_FIVE_TRAITS = [
  "Openness",
  "Conscientiousness",
  "Extraversion",
  "Agreeableness",
  "Emotional Stability",
] as const;

export type BigFiveTrait = (typeof BIG_FIVE_TRAITS)[number];

export type BigFiveItem = {
  id: string;
  trait: BigFiveTrait;
  text: string;
  reverse: boolean; // true when agreement counts against the trait
};

// 4 items per trait, interleaved so no two consecutive items share a trait —
// reduces the pattern-matching/straight-lining response bias a blocked
// layout invites.
export const BIG_FIVE_ITEMS: BigFiveItem[] = [
  { id: "o1", trait: "Openness", text: "I enjoy exploring new ideas, even ones with no obvious practical use.", reverse: false },
  { id: "c1", trait: "Conscientiousness", text: "I follow through on commitments even when no one is checking up on me.", reverse: false },
  { id: "e1", trait: "Extraversion", text: "I feel energized after spending time with a group of people.", reverse: false },
  { id: "a1", trait: "Agreeableness", text: "I go out of my way to help a colleague, even when it's not my job.", reverse: false },
  { id: "s1", trait: "Emotional Stability", text: "I get stressed out easily when things don't go as planned.", reverse: true },

  { id: "o2", trait: "Openness", text: "I look for creative or unconventional ways to solve problems.", reverse: false },
  { id: "c2", trait: "Conscientiousness", text: "I plan ahead rather than figuring things out as I go.", reverse: false },
  { id: "e2", trait: "Extraversion", text: "I'm usually the one who starts a conversation in a new group.", reverse: false },
  { id: "a2", trait: "Agreeableness", text: "I try to see a disagreement from the other person's point of view.", reverse: false },
  { id: "s2", trait: "Emotional Stability", text: "My mood can shift quickly depending on small setbacks.", reverse: true },

  { id: "o3", trait: "Openness", text: "I prefer sticking to familiar methods rather than experimenting with new ones.", reverse: true },
  { id: "c3", trait: "Conscientiousness", text: "I often leave tasks until the last minute.", reverse: true },
  { id: "e3", trait: "Extraversion", text: "I prefer working alone over working with others.", reverse: true },
  { id: "a3", trait: "Agreeableness", text: "I find it hard to trust people until they've proven themselves.", reverse: true },
  { id: "s3", trait: "Emotional Stability", text: "I stay calm under pressure.", reverse: false },

  { id: "o4", trait: "Openness", text: "I'm genuinely curious about topics outside my own field.", reverse: false },
  { id: "c4", trait: "Conscientiousness", text: "I keep my work and priorities organized.", reverse: false },
  { id: "e4", trait: "Extraversion", text: "I speak up quickly in meetings or discussions.", reverse: false },
  { id: "a4", trait: "Agreeableness", text: "I give people the benefit of the doubt.", reverse: false },
  { id: "s4", trait: "Emotional Stability", text: "I tend to worry about things more than most people.", reverse: true },
];

export function scoreBigFive(answers: Record<string, number>): Record<BigFiveTrait, number> {
  const scores = {} as Record<BigFiveTrait, number>;
  for (const trait of BIG_FIVE_TRAITS) {
    const items = BIG_FIVE_ITEMS.filter((i) => i.trait === trait);
    const values = items.map((i) => {
      const raw = answers[i.id] ?? 3;
      return i.reverse ? 6 - raw : raw;
    });
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    scores[trait] = Math.round(((avg - 1) / 4) * 100);
  }
  return scores;
}

const BAND = (score: number): "low" | "mid" | "high" => (score >= 70 ? "high" : score >= 40 ? "mid" : "low");

export const BIG_FIVE_INTERPRETATIONS: Record<BigFiveTrait, Record<"low" | "mid" | "high", string>> = {
  Openness: {
    high: "You gravitate toward new approaches and abstract problem-solving — useful in ambiguous, fast-changing work.",
    mid: "You balance new ideas with proven methods, adapting your approach to the situation.",
    low: "You favor proven, practical methods over experimentation — a strength in stable, execution-heavy roles.",
  },
  Conscientiousness: {
    high: "You're reliable under low supervision and plan ahead rather than improvise — valuable in autonomous or high-trust roles.",
    mid: "You're organized most of the time, with some flexibility in how closely you follow a plan.",
    low: "You work more spontaneously than by plan — pairing well with structured teammates or checklists.",
  },
  Extraversion: {
    high: "You draw energy from people and tend to lead conversations — a natural fit for client-facing or highly collaborative work.",
    mid: "You're comfortable in both group settings and independent work, depending on what the day calls for.",
    low: "You do your best thinking independently and in smaller settings — a strength in focused, deep-work roles.",
  },
  Agreeableness: {
    high: "You prioritize cooperation and trust readily — an asset for team cohesion, though worth watching in high-stakes negotiations.",
    mid: "You balance cooperation with healthy skepticism, adjusting trust to the situation.",
    low: "You're comfortable pushing back and questioning assumptions — useful in negotiation or quality-control roles.",
  },
  "Emotional Stability": {
    high: "You stay composed under pressure and recover quickly from setbacks.",
    mid: "You handle most pressure well, with occasional stress in high-stakes moments.",
    low: "You feel pressure more intensely than most — worth pairing with deliberate stress-management habits, especially in high-stakes roles.",
  },
};

export function bigFiveInterpretation(trait: BigFiveTrait, score: number): string {
  return BIG_FIVE_INTERPRETATIONS[trait][BAND(score)];
}
