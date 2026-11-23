import { describe, expect, it } from "vitest";
import { hasLeft } from "./leaver";

describe("hasLeft", () => {
  it("treats an active, un-archived person as still here", () => {
    expect(hasLeft({ archived: false, employment_status: "active" })).toBe(false);
  });
  it("treats an archived person as having left", () => {
    expect(hasLeft({ archived: true, employment_status: "active" })).toBe(true);
  });
  it("treats resigned and terminated people as having left, even when they are not archived", () => {
    expect(hasLeft({ archived: false, employment_status: "resigned" })).toBe(true);
    expect(hasLeft({ archived: false, employment_status: "terminated" })).toBe(true);
  });
  it("treats a missing status as active, because the column defaults to active", () => {
    expect(hasLeft({ archived: null, employment_status: null })).toBe(false);
    expect(hasLeft({})).toBe(false);
  });
  it("counts a person who is both archived and resigned as having left", () => {
    expect(hasLeft({ archived: true, employment_status: "resigned" })).toBe(true);
  });
});
