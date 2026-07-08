export const ACCOMMODATIONS = [
  "Standard",
  "Bite-sized & low-distraction",
  "Audio/video-first",
  "Structured & predictable",
] as const;

export type Accommodation = (typeof ACCOMMODATIONS)[number];

export const ACCOMMODATION_DESCRIPTIONS: Record<Accommodation, string> = {
  Standard: "No specific accommodation — default pacing and format.",
  "Bite-sized & low-distraction":
    "Shorter sessions, broken into smaller steps. Good fit if long unstructured blocks of time don't work for you.",
  "Audio/video-first":
    "Prioritizes listening and watching over dense reading wherever a resource offers both.",
  "Structured & predictable":
    "Fixed, explicit scheduling — same day and time each week, no ambiguity about when or how much.",
};

// This is a transformation layer, not a separate content library — it
// reshapes the same underlying action (title, description, pacing) rather
// than requiring a bespoke entry per dimension x format x accommodation,
// which would be unmaintainable at 160+ combinations.
export function applyAccommodation(
  action: { title: string; description: string },
  accommodation: Accommodation | null
): { title: string; description: string; paceMultiplier: number } {
  switch (accommodation) {
    case "Bite-sized & low-distraction":
      return {
        title: `${action.title} — in short sessions`,
        description: `${action.description} Break this into 15-20 minute sessions in a low-distraction space. One sitting is real progress — you don't need to finish it in one go.`,
        paceMultiplier: 1.5,
      };
    case "Audio/video-first":
      return {
        title: action.title,
        description: `${action.description} Look for an audio or video version of this over dense text wherever one exists.`,
        paceMultiplier: 1,
      };
    case "Structured & predictable":
      return {
        title: action.title,
        description: `${action.description} Do this at the same day and time each week so it stays predictable rather than open-ended.`,
        paceMultiplier: 1,
      };
    default:
      return { title: action.title, description: action.description, paceMultiplier: 1 };
  }
}
