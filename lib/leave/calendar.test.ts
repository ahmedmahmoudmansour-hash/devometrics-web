import { describe, expect, it } from "vitest";
import { countWorkingDays, DEFAULT_WEEKEND_DAYS } from "./calendar";

// 2026-10-05 is a Monday; ISO weekdays: 1 = Mon ... 7 = Sun. Default weekend
// is Friday + Saturday (5, 6).
describe("countWorkingDays", () => {
  it("counts a full Mon-Sun week with a Fri/Sat weekend as 5 working days", () => {
    expect(countWorkingDays("2026-10-05", "2026-10-11", DEFAULT_WEEKEND_DAYS, [])).toBe(5);
  });

  it("honours a Sat/Sun weekend", () => {
    expect(countWorkingDays("2026-10-05", "2026-10-11", [6, 7], [])).toBe(5);
    expect(countWorkingDays("2026-10-09", "2026-10-11", [6, 7], [])).toBe(1); // Fri only
  });

  it("excludes public holidays that fall on working days", () => {
    expect(countWorkingDays("2026-10-05", "2026-10-11", DEFAULT_WEEKEND_DAYS, ["2026-10-06"])).toBe(4);
  });

  it("does not double-count a holiday that falls on a weekend day", () => {
    expect(countWorkingDays("2026-10-05", "2026-10-11", DEFAULT_WEEKEND_DAYS, ["2026-10-09"])).toBe(5);
  });

  it("returns 0 for a range made only of weekend days or holidays", () => {
    expect(countWorkingDays("2026-10-09", "2026-10-10", DEFAULT_WEEKEND_DAYS, [])).toBe(0);
    expect(countWorkingDays("2026-10-06", "2026-10-06", DEFAULT_WEEKEND_DAYS, ["2026-10-06"])).toBe(0);
  });

  it("counts a single working day as 1 and is inclusive of both ends", () => {
    expect(countWorkingDays("2026-10-07", "2026-10-07", DEFAULT_WEEKEND_DAYS, [])).toBe(1);
    expect(countWorkingDays("2026-10-05", "2026-10-06", DEFAULT_WEEKEND_DAYS, [])).toBe(2);
  });

  it("returns 0 for empty or reversed ranges", () => {
    expect(countWorkingDays("", "2026-10-07", DEFAULT_WEEKEND_DAYS, [])).toBe(0);
    expect(countWorkingDays("2026-10-08", "2026-10-07", DEFAULT_WEEKEND_DAYS, [])).toBe(0);
  });

  it("counts across a month boundary", () => {
    expect(countWorkingDays("2026-09-28", "2026-10-02", [6, 7], [])).toBe(5);
  });

  it("stays bounded for an absurdly long range", () => {
    expect(countWorkingDays("2020-01-01", "2030-01-01", [6, 7], [])).toBeLessThanOrEqual(401);
  });
});
