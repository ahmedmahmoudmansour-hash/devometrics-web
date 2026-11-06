import { describe, expect, it } from "vitest";
import { availableOn } from "./employeePicker";

const DAY = 86400000;
const NOW = Date.parse("2026-11-07T12:00:00Z");

describe("availableOn (retake interval shown before anyone clicks Assign)", () => {
  it("is null when the person has never had an assessment", () => {
    expect(availableOn(undefined, 30, NOW)).toBeNull();
  });
  it("is null when the retake rule is switched off", () => {
    expect(availableOn(new Date(NOW - DAY).toISOString(), 0, NOW)).toBeNull();
  });
  it("gives the date the interval ends when the last assessment is recent", () => {
    const last = new Date(NOW - 10 * DAY).toISOString();
    expect(availableOn(last, 30, NOW)).toBe(new Date(NOW + 20 * DAY).toISOString());
  });
  it("is null once the interval has passed, so the person can be assigned again", () => {
    expect(availableOn(new Date(NOW - 31 * DAY).toISOString(), 30, NOW)).toBeNull();
  });
  it("matches the server rule exactly at the boundary (assignable when exactly the interval has passed)", () => {
    expect(availableOn(new Date(NOW - 30 * DAY).toISOString(), 30, NOW)).toBeNull();
  });
});
