import type { CompetencyDimension } from "./dimensions";
import type { LearningFormat } from "./actionLibrary";

// Real, well-known platforms per dimension, with a specific topic phrase to
// search for — not a fabricated exact course title (catalogs change
// constantly and we have no live way to verify a specific listing still
// exists), but specific enough to stop feeling generic. This is what
// actually drives someone from "go take a course" to "go search this
// exact phrase on this exact site."
const RESOURCE_SEARCH: Record<CompetencyDimension, { platforms: string[]; searchTerm: string }> = {
  "Technical Skills": {
    platforms: ["Coursera", "Udemy", "YouTube"],
    searchTerm: "the specific tool, language, or framework your target role's job description names most",
  },
  Leadership: {
    platforms: ["LinkedIn Learning", "Coursera"],
    searchTerm: "situational leadership and giving difficult feedback",
  },
  "Strategic Thinking": {
    platforms: ["Coursera", "edX"],
    searchTerm: "strategic thinking frameworks and business strategy",
  },
  Communication: {
    platforms: ["LinkedIn Learning", "YouTube"],
    searchTerm: "executive communication and public speaking",
  },
  "AI & Digital Skills": {
    platforms: ["Coursera", "Google's Grow with Google", "YouTube"],
    searchTerm: "practical AI tools for your specific role, not general AI theory",
  },
  "Critical Thinking": {
    platforms: ["Coursera", "edX"],
    searchTerm: "critical thinking, logic, and decision-making under uncertainty",
  },
  "People Management": {
    platforms: ["LinkedIn Learning", "Coursera"],
    searchTerm: "people management and running effective 1:1s",
  },
  "Financial Literacy": {
    platforms: ["Coursera", "Khan Academy"],
    searchTerm: "financial literacy and business finance for non-finance managers",
  },
};

// Formats where "go search a platform for this topic" is the right kind of
// nudge — doesn't apply to formats like Hands-on projects or Peer learning,
// which aren't about finding a course at all.
const SEARCHABLE_FORMATS: LearningFormat[] = [
  "Video courses",
  "Professional certifications",
  "Short courses & workshops",
  "Webinars & virtual events",
  "Live cohort classes",
];

export function resourceSearchNote(
  dimension: CompetencyDimension,
  format: LearningFormat,
  location: string | null
): string {
  if (!SEARCHABLE_FORMATS.includes(format)) return "";
  const { platforms, searchTerm } = RESOURCE_SEARCH[dimension];
  const platformList = platforms.slice(0, 2).join(" or ");
  const localTip =
    format === "Live cohort classes" && location
      ? ` Since you're in ${location}, also check Meetup or local professional associations for an in-person or regional cohort.`
      : "";
  return `Search ${platformList} for "${searchTerm}".${localTip}`;
}
