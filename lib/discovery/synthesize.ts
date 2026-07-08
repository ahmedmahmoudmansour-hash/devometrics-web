import Anthropic from "@anthropic-ai/sdk";
import type { DiscoveryAnswer } from "./questions";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function synthesizeDiscoveryProfile(answers: DiscoveryAnswer[]): Promise<string> {
  const transcript = answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 800,
    system: `You are the Devometrics Discovery Interview synthesizer. Given short answers to 5 fixed questions about someone's actual day-to-day work, write a 2-3 paragraph narrative profile summary.

Ground everything in what was actually said — do not invent responsibilities, seniority, or achievements not implied by the answers. If an answer is thin or vague, reflect that honestly (e.g. "day-to-day responsibilities weren't fully described") rather than padding it out. Write in second person ("You..."), plain and direct — this should read like a sharp, accurate summary a good manager could recognize, not marketing copy.`,
    messages: [{ role: "user", content: transcript }],
  });

  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}
