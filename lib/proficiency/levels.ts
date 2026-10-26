// Five named proficiency levels laid over the 0 to 100 scores used everywhere in
// Devometrics (current level, target level, role requirement). The scores stay
// as they are, so no data needs migrating; a level is simply the band a score
// falls in. Labels and descriptors are translated in the "proficiency" messages.

export type ProficiencyLevel = 1 | 2 | 3 | 4 | 5;

export const PROFICIENCY_LEVELS: ProficiencyLevel[] = [1, 2, 3, 4, 5];

// Inclusive score range of each level. On a role requirement, 0 means "not
// required". It never means "no evidence": a person who has not been assessed has
// no score at all (null), which is a different state from a low score and from a
// competency the role does not need. Neither has a level.
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
// means the person is below the level the role needs. Returns null (no gap to
// report) when the role does not require the competency, and also when the person
// has not been assessed: missing evidence is never read as low proficiency.
export function levelGap(required: number | null | undefined, assessed: number | null | undefined): number | null {
  const r = proficiencyLevel(required);
  if (r === null) return null;
  const a = proficiencyLevel(assessed);
  if (a === null) return null;
  return r - a;
}

export type CompetencyState = "not_required" | "not_assessed" | "scored";

// The three states a competency can be in for one person against one role.
export function competencyState(required: number | null | undefined, assessed: number | null | undefined): CompetencyState {
  if (proficiencyLevel(required) === null) return "not_required";
  return proficiencyLevel(assessed) === null ? "not_assessed" : "scored";
}
