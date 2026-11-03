import { describe, expect, it } from "vitest";
import { buildCalibration, CALIBRATION, type CalibrationRow } from "./calibration";

function rows(manager: string, name: string, ratings: number[], self: (number | null)[] = []): CalibrationRow[] {
  return ratings.map((rating, i) => ({ reviewerUserId: manager, reviewerName: name, rating, selfRating: self[i] ?? null }));
}

describe("buildCalibration", () => {
  it("returns an empty report for no ratings", () => {
    const r = buildCalibration([]);
    expect(r).toMatchObject({ totalRatings: 0, companyMean: null, companySpread: null, managers: [], hiddenManagers: 0 });
  });

  it("counts the distribution and the company average", () => {
    const r = buildCalibration([...rows("a", "A", [3, 3, 4, 4, 5]), ...rows("b", "B", [2, 3, 3, 3, 4])]);
    expect(r.totalRatings).toBe(10);
    expect(r.distribution).toEqual({ 1: 0, 2: 1, 3: 5, 4: 3, 5: 1 });
    expect(r.companyMean).toBe(3.4);
  });

  it("does not list a manager with fewer ratings than the minimum, but still counts them", () => {
    const few = rows("c", "C", [5, 5, 5, 5]);
    expect(few.length).toBe(CALIBRATION.minRatings - 1);
    const r = buildCalibration([...rows("a", "A", [3, 3, 3, 4, 4]), ...few]);
    expect(r.managers.map((m) => m.name)).toEqual(["A"]);
    expect(r.hiddenManagers).toBe(1);
    expect(r.hiddenRatings).toBe(4);
    expect(r.totalRatings).toBe(9);
  });

  it("flags a manager well above and well below the company average", () => {
    const r = buildCalibration([
      ...rows("hi", "High", [5, 4, 5, 4, 5, 4]),
      ...rows("lo", "Low", [2, 3, 2, 3, 2, 3]),
      ...rows("mid", "Mid", [3, 4, 3, 4, 3, 4]),
    ]);
    const by = Object.fromEntries(r.managers.map((m) => [m.name, m.flags]));
    expect(by.High).toContain("above_company");
    expect(by.Low).toContain("below_company");
    expect(by.Mid).not.toContain("above_company");
    expect(by.Mid).not.toContain("below_company");
  });

  it("flags a narrow spread when nearly everyone gets the same rating", () => {
    const r = buildCalibration([...rows("a", "A", [4, 4, 4, 4, 4, 4]), ...rows("b", "B", [2, 3, 4, 5, 3, 4])]);
    expect(r.managers.find((m) => m.name === "A")?.flags).toContain("narrow_spread");
    expect(r.managers.find((m) => m.name === "B")?.flags).not.toContain("narrow_spread");
  });

  it("computes the manager minus self gap only with at least three pairs", () => {
    const r = buildCalibration([
      ...rows("a", "A", [4, 4, 3, 3, 4], [3, 3, 3, 4, null]),
      ...rows("b", "B", [3, 3, 3, 3, 3], [null, null, 3, 3, null]),
    ]);
    // A: pairs (4-3, 4-3, 3-3, 3-4) = 1, 1, 0, -1 -> mean 0.25
    expect(r.managers.find((m) => m.name === "A")?.selfGap).toBe(0.25);
    expect(r.managers.find((m) => m.name === "B")?.selfGap).toBeNull();
  });

  it("ignores impossible ratings instead of counting them", () => {
    const bad: CalibrationRow[] = [
      { reviewerUserId: "a", reviewerName: "A", rating: 0, selfRating: null },
      { reviewerUserId: "a", reviewerName: "A", rating: 6, selfRating: null },
      { reviewerUserId: "a", reviewerName: "A", rating: 3.5, selfRating: null },
    ];
    expect(buildCalibration(bad).totalRatings).toBe(0);
  });

  it("uses the sample standard deviation", () => {
    const r = buildCalibration(rows("a", "A", [1, 2, 3, 4, 5]));
    expect(r.managers[0].spread).toBe(1.58);
  });
});
