import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Reuses the CV text already uploaded for Gap Analysis instead of asking the
// user to re-type their work history and education on their profile — one
// short, cached summary per analysis, not a re-extraction on every page view.
export async function extractExperienceSummary(cvText: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 500,
    system: `Summarize this person's work experience and education based only on what's actually in the text below. 2-4 short bullet points for experience (most recent first, role/organization/duration if stated), then 1-2 lines for education. Plain text, no markdown headers. Do not invent roles, dates, or degrees that aren't stated — if education isn't mentioned, say "Not specified in CV" for that line rather than guessing.`,
    messages: [{ role: "user", content: cvText }],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("Model did not return a summary");
  return block.text.trim();
}
