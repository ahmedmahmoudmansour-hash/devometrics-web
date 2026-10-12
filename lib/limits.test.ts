import { describe, expect, it } from "vitest";
import {
  HIRING_CV_SCORE_RATE_LIMIT_BASE_RUNS,
  MAX_PLATFORM_CHAT_HISTORY,
  MAX_PLATFORM_CHAT_HISTORY_ENTRY_LENGTH,
  MAX_PLATFORM_CHAT_MESSAGE_LENGTH,
  hiringCvScoreDailyLimit,
} from "./limits";

describe("hiringCvScoreDailyLimit", () => {
  it("never goes below the base allowance, even for a tiny company", () => {
    expect(hiringCvScoreDailyLimit(0)).toBe(HIRING_CV_SCORE_RATE_LIMIT_BASE_RUNS);
    expect(hiringCvScoreDailyLimit(10)).toBe(HIRING_CV_SCORE_RATE_LIMIT_BASE_RUNS);
  });

  it("scales with headcount for large companies", () => {
    expect(hiringCvScoreDailyLimit(1000)).toBe(500);
    expect(hiringCvScoreDailyLimit(1001)).toBe(501);
  });
});

describe("public chatbot limits are sane", () => {
  it("bounds a request to a small, finite prompt size", () => {
    const worstCaseChars = MAX_PLATFORM_CHAT_MESSAGE_LENGTH + MAX_PLATFORM_CHAT_HISTORY * MAX_PLATFORM_CHAT_HISTORY_ENTRY_LENGTH;
    expect(worstCaseChars).toBeLessThanOrEqual(50_000);
  });
});
