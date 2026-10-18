import { describe, expect, it } from "vitest";
import { bilingualName } from "./names";

describe("bilingualName", () => {
  it("shows both names, reader's language first", () => {
    expect(bilingualName("Omar Khalil", "عمر خليل", "en")).toBe("Omar Khalil · عمر خليل");
    expect(bilingualName("Omar Khalil", "عمر خليل", "ar")).toBe("عمر خليل · Omar Khalil");
  });

  it("defaults to English first", () => {
    expect(bilingualName("Omar Khalil", "عمر خليل")).toBe("Omar Khalil · عمر خليل");
  });

  it("shows a single name alone", () => {
    expect(bilingualName("Omar Khalil", null)).toBe("Omar Khalil");
    expect(bilingualName("Omar Khalil", "   ")).toBe("Omar Khalil");
    expect(bilingualName(null, "عمر خليل")).toBe("عمر خليل");
    expect(bilingualName("", "عمر خليل", "ar")).toBe("عمر خليل");
  });

  it("does not repeat an identical name", () => {
    expect(bilingualName("Omar", "Omar")).toBe("Omar");
  });

  it("falls back to a dash when there is no name", () => {
    expect(bilingualName(null, null)).toBe("—");
    expect(bilingualName(undefined, "")).toBe("—");
  });

  it("trims whitespace", () => {
    expect(bilingualName("  Omar Khalil ", " عمر خليل ")).toBe("Omar Khalil · عمر خليل");
  });
});
