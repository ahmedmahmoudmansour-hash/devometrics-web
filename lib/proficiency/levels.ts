// Five named proficiency levels laid over the 0 to 100 scores used everywhere in
// Devometrics (current level, target level, role requirement). The scores stay
// as they are, so no data needs migrating; a level is simply the band a score
// falls in. Labels and descriptors are translated in the "proficiency" messages.

export type ProficiencyLevel = 1 | 2 | 3 | 4 | 5;

export const PROFICIENCY_LEVELS: ProficiencyLevel[] = [1, 2, 3, 4, 5];

// Inclusive score range of each level. 0 means "not required" (for a role
// requirement) or "no evidence" (for an assessed score), and has no level.
export const LEVEL_BANDS: Record<ProficiencyLevel, { min: number; max: number }> = {
  1: { min: 1, max: 20 },
  2: { min: 21, max: 40 },
  3: { min: 41, max: 60 },
  4: { min: 61, max: 80 },
  5: { min: 81, max: 100 },
};

// The level a 0 to 100 score falls in, or null when there is none (0, or not a number).
export function proficiencyLevel(score: number | null | undefined): ProficiencyLevel | null {
  if (typeof score !== "number" || Number.isNaN(score)) return null;
  const s = Math.round(score);
  if (s < 1) return null;
  if (s <= 20) return 1;
  if (s <= 40) return 2;
  if (s <= 60) return 3;
  if (s <= 80) return 4;
  return 5;
}

// The score to store when someone picks a level: the middle of its band, so a
// chosen level reads back as the same level.
export function scoreForLevel(level: ProficiencyLevel): number {
  const { min, max } = LEVEL_BANDS[level];
  return Math.round((min + max) / 2);
}

// How many levels apart an assessed score is from the requirement. Positive
// means the person is below the level the role needs.
export function levelGap(required: number | null | undefined, assessed: number | null | undefined): number | null {
  const r = proficiencyLevel(required);
  if (r === null) return null;
  const a = proficiencyLevel(assessed) ?? 0;
  return r - a;
}
