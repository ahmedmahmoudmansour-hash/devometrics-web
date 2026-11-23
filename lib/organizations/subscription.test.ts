import { describe, expect, it } from "vitest";
import { isSubscriptionLapsed, subscriptionDaysLeft } from "./subscription";

const now = new Date("2026-11-23T12:00:00Z");

describe("company subscription", () => {
  it("is not lapsed when active with no end date (every existing company after 0213)", () => {
    expect(isSubscriptionLapsed({ status: "active", endsAt: null }, now)).toBe(false);
  });
  it("is not lapsed when 0213 is not applied yet or the read failed", () => {
    expect(isSubscriptionLapsed(null, now)).toBe(false);
    expect(isSubscriptionLapsed(undefined, now)).toBe(false);
    expect(isSubscriptionLapsed({ status: null, endsAt: null }, now)).toBe(false);
  });
  it("is lapsed when marked expired, whatever the date", () => {
    expect(isSubscriptionLapsed({ status: "expired", endsAt: "2099-01-01" }, now)).toBe(true);
  });
  it("is lapsed once a trial or paid period has ended", () => {
    expect(isSubscriptionLapsed({ status: "trial", endsAt: "2026-11-23T11:59:59Z" }, now)).toBe(true);
    expect(isSubscriptionLapsed({ status: "active", endsAt: "2026-11-01" }, now)).toBe(true);
  });
  it("is not lapsed before the end date", () => {
    expect(isSubscriptionLapsed({ status: "trial", endsAt: "2026-12-31" }, now)).toBe(false);
  });
  it("ignores an unreadable date rather than locking anyone out", () => {
    expect(isSubscriptionLapsed({ status: "trial", endsAt: "not a date" }, now)).toBe(false);
  });
  it("counts whole days left", () => {
    expect(subscriptionDaysLeft({ status: "trial", endsAt: "2026-11-30T12:00:00Z" }, now)).toBe(7);
    expect(subscriptionDaysLeft({ status: "trial", endsAt: "2026-11-23T18:00:00Z" }, now)).toBe(0);
    expect(subscriptionDaysLeft({ status: "active", endsAt: null }, now)).toBeNull();
    expect(subscriptionDaysLeft({ status: "trial", endsAt: "2026-11-01" }, now)).toBeNull();
  });
});
