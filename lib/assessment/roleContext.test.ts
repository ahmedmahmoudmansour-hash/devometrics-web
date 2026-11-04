import { describe, expect, it } from "vitest";
import { roleContextKey, ROLE_CONTEXT_MAX } from "./roleContext";

describe("roleContextKey", () => {
  it("treats the same role written differently as one role", () => {
    expect(roleContextKey("  HR   Generalist ")).toBe("hr generalist");
    expect(roleContextKey("hr generalist")).toBe("hr generalist");
  });
  it("keeps different roles apart", () => {
    expect(roleContextKey("HR Generalist")).not.toBe(roleContextKey("Maintenance Engineer"));
  });
  it("is safe for missing or very long titles", () => {
    expect(roleContextKey(null)).toBe("");
    expect(roleContextKey(undefined)).toBe("");
    expect(roleContextKey("x".repeat(500)).length).toBe(ROLE_CONTEXT_MAX);
  });
  it("works for Arabic titles", () => {
    expect(roleContextKey("  مهندس   صيانة ")).toBe("مهندس صيانة");
  });
});
