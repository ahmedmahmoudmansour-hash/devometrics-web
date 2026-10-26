import { describe, expect, it } from "vitest";
import { LEVEL_BANDS, PROFICIENCY_LEVELS, levelGap, proficiencyLevel, scoreForLevel } from "./levels";

describe("proficiencyLevel", () => {
  it("maps scores to the five bands", () => {
    expect(proficiencyLevel(1)).toBe(1);
    expect(proficiencyLevel(20)).toBe(1);
    expect(proficiencyLevel(21)).toBe(2);
    expect(proficiencyLevel(40)).toBe(2);
    expect(proficiencyLevel(41)).toBe(3);
    expect(proficiencyLevel(60)).toBe(3);
    expect(proficiencyLevel(61)).toBe(4);
    expect(proficiencyLevel(80)).toBe(4);
    expect(proficiencyLevel(81)).toBe(5);
    expect(proficiencyLevel(100)).toBe(5);
  });

  it("has no level for zero or unusable input", () => {
    expect(proficiencyLevel(0)).toBeNull();
    expect(proficiencyLevel(-5)).toBeNull();
    expect(proficiencyLevel(null)).toBeNull();
    expect(proficiencyLevel(undefined)).toBeNull();
    expect(proficiencyLevel(Number.NaN)).toBeNull();
  });

  it("rounds before banding", () => {
    expect(proficiencyLevel(20.4)).toBe(1);
    expect(proficiencyLevel(20.6)).toBe(2);
  });

  it("covers 1 to 100 with no gaps or overlaps", () => {
    const seen = new Map<number, number>();
    for (let s = 1; s <= 100; s++) {
      const lvl = proficiencyLevel(s);
      expect(lvl).not.toBeNull();
      const { min, max } = LEVEL_BANDS[lvl!];
      expect(s >= min && s <= max).toBe(true);
      seen.set(lvl!, (seen.get(lvl!) ?? 0) + 1);
    }
    expect([...seen.keys()].sort()).toEqual(PROFICIENCY_LEVELS);
  });
});

describe("scoreForLevel", () => {
  it("returns a score that reads back as the same level", () => {
    for (const level of PROFICIENCY_LEVELS) expect(proficiencyLevel(scoreForLevel(level))).toBe(level);
  });
});

describe("levelGap", () => {
  it("is positive when below the requirement, zero when met, negative when above", () => {
    expect(levelGap(80, 45)).toBe(1); // level 4 needed, level 3 shown
    expect(levelGap(60, 60)).toBe(0);
    expect(levelGap(40, 90)).toBe(-3);
  });
  it("treats no evidence as below every requirement", () => {
    expect(levelGap(50, 0)).toBe(3);
    expect(levelGap(50, null)).toBe(3);
  });
  it("has no gap when the role does not require the competency", () => {
    expect(levelGap(0, 70)).toBeNull();
    expect(levelGap(null, 70)).toBeNull();
  });
});
