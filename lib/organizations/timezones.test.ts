import { describe, expect, it } from "vitest";
import { COMMON_TIMEZONES, DEFAULT_TIMEZONE, isValidTimezone, wallClockIn } from "./timezones";

describe("wallClockIn", () => {
  // 2026-10-09T22:30:00Z
  const at = new Date(Date.UTC(2026, 9, 9, 22, 30));

  it("returns the date and time on the company's wall clock", () => {
    expect(wallClockIn("UTC", at)).toEqual({ date: "2026-10-09", time: "22:30" });
    expect(wallClockIn("Asia/Dubai", at)).toEqual({ date: "2026-10-10", time: "02:30" }); // UTC+4, next day
    expect(wallClockIn("America/New_York", at)).toEqual({ date: "2026-10-09", time: "18:30" }); // EDT, UTC-4
  });

  it("uses 24-hour time with no 24:00", () => {
    const midnightUtc = new Date(Date.UTC(2026, 0, 1, 0, 5));
    expect(wallClockIn("UTC", midnightUtc).time).toBe("00:05");
  });
});

describe("isValidTimezone / lists", () => {
  it("accepts real zones and rejects junk", () => {
    expect(isValidTimezone("Africa/Cairo")).toBe(true);
    expect(isValidTimezone("Not/AZone")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
  });

  it("every offered timezone is valid, and the default is among them", () => {
    for (const tz of COMMON_TIMEZONES) expect(isValidTimezone(tz)).toBe(true);
    expect(COMMON_TIMEZONES).toContain(DEFAULT_TIMEZONE);
  });
});
