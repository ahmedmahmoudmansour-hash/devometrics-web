// Fixed, guided sequence — matches the PRD's own AI Discovery Interview
// spec. Answered one at a time, not free-form chat: that's what makes this
// mechanically different from the Coach.
export const DISCOVERY_QUESTIONS = [
  "What do you actually do every day?",
  "What decisions do you make?",
  "What software or tools do you use?",
  "What projects do you lead or contribute to?",
  "What challenges consume most of your time?",
] as const;

export type DiscoveryAnswer = { question: string; answer: string };
