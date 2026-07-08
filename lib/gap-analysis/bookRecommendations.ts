import type { CompetencyDimension } from "./dimensions";

// Real, genuinely well-known, verifiable books — the opposite of the
// specific-research-citation fabrication risk flagged earlier this session.
// These titles actually exist and are broadly credible; naming them isn't
// making anything up the way inventing a study or paper would be. Two per
// dimension, not an exhaustive reading list — a concrete starting point,
// not a syllabus.
export const BOOK_RECOMMENDATIONS: Record<CompetencyDimension, { title: string; author: string }[]> = {
  "Technical Skills": [
    { title: "Peak: Secrets from the New Science of Expertise", author: "Anders Ericsson" },
    { title: "The Pragmatic Programmer", author: "Andrew Hunt & David Thomas" },
  ],
  Leadership: [
    { title: "The Five Dysfunctions of a Team", author: "Patrick Lencioni" },
    { title: "Leaders Eat Last", author: "Simon Sinek" },
  ],
  "Strategic Thinking": [
    { title: "Good Strategy Bad Strategy", author: "Richard Rumelt" },
    { title: "Playing to Win", author: "A.G. Lafley & Roger Martin" },
  ],
  Communication: [
    { title: "Crucial Conversations", author: "Kerry Patterson et al." },
    { title: "Made to Stick", author: "Chip Heath & Dan Heath" },
  ],
  "AI & Digital Skills": [
    { title: "Co-Intelligence", author: "Ethan Mollick" },
    { title: "Prediction Machines", author: "Ajay Agrawal, Joshua Gans & Avi Goldfarb" },
  ],
  "Critical Thinking": [
    { title: "Thinking, Fast and Slow", author: "Daniel Kahneman" },
    { title: "The Art of Thinking Clearly", author: "Rolf Dobelli" },
  ],
  "People Management": [
    { title: "Radical Candor", author: "Kim Scott" },
    { title: "The Making of a Manager", author: "Julie Zhuo" },
  ],
  "Financial Literacy": [
    { title: "Financial Intelligence", author: "Karen Berman & Joe Knight" },
    { title: "The Personal MBA", author: "Josh Kaufman" },
  ],
};

export function bookRecommendationNote(dimension: CompetencyDimension): string {
  const [first, second] = BOOK_RECOMMENDATIONS[dimension];
  return `Worth reading: "${first.title}" by ${first.author}, or "${second.title}" by ${second.author}.`;
}
