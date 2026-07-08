import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type JobHistoryEntry = {
  title: string;
  company: string;
  duration: string;
  description: string;
};

export type QualificationEntry = {
  credential: string;
  institution: string;
  year: string;
};

export type ExtractedCareerProfile = {
  jobHistory: JobHistoryEntry[];
  skills: string[];
  qualifications: QualificationEntry[];
};

const RECORD_TOOL = {
  name: "record_career_profile",
  description: "Record the candidate's structured job history, skills, and qualifications extracted from their CV.",
  input_schema: {
    type: "object" as const,
    properties: {
      jobHistory: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            title: { type: "string", description: "Job title as stated" },
            company: { type: "string", description: "Employer/organization name as stated" },
            duration: { type: "string", description: 'e.g. "2021 - 2024" or "Jan 2020 - Present", as stated in the CV' },
            description: { type: "string", description: "1-2 sentence summary of responsibilities/achievements in this role" },
          },
          required: ["title", "company", "duration", "description"],
        },
      },
      skills: {
        type: "array" as const,
        items: { type: "string" },
        description: "Concrete skills explicitly stated or clearly demonstrated in the CV — not inferred or generic",
      },
      qualifications: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            credential: { type: "string", description: "Degree, certification, or qualification name" },
            institution: { type: "string", description: "School/issuing body as stated" },
            year: { type: "string", description: "Year completed/awarded, or empty string if not stated" },
          },
          required: ["credential", "institution", "year"],
        },
      },
    },
    required: ["jobHistory", "skills", "qualifications"],
  },
};

// Reuses the CV text already uploaded for Gap Analysis — same "don't make
// the user re-type their own history" principle as extractExperienceSummary,
// but structured (LinkedIn-style fields) instead of prose, so it can be
// individually edited and re-saved.
export async function extractCareerProfile(cvText: string): Promise<ExtractedCareerProfile> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2048,
    system:
      "Extract this person's job history, skills, and qualifications from the CV text below, exactly as stated. Do not invent roles, dates, employers, or credentials that aren't in the text. If a field genuinely isn't stated (e.g. no end date), use an empty string rather than guessing. Most recent job first.",
    tools: [RECORD_TOOL],
    tool_choice: { type: "tool", name: "record_career_profile" },
    messages: [{ role: "user", content: cvText }],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return structured output");
  }

  return toolUse.input as ExtractedCareerProfile;
}
