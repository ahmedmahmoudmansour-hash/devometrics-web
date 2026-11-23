// A company's subscription (migration 0213): 'trial' | 'active' | 'expired', with an optional end date. Set only by Devometrics.
// Pure, so it is tested without a database.

export type CompanySubscription = { status: string | null; endsAt: string | null };

// Lapsed = access should stop: marked expired, or the end date has passed. Anything unknown or missing (including a database where 0213
// is not applied yet) counts as NOT lapsed, so a missing column can never lock a company out by mistake.
export function isSubscriptionLapsed(sub: CompanySubscription | null | undefined, now: Date = new Date()): boolean {
  if (!sub) return false;
  if (sub.status === "expired") return true;
  if (sub.endsAt) {
    const ends = new Date(sub.endsAt);
    if (!Number.isNaN(ends.getTime()) && ends.getTime() <= now.getTime()) return true;
  }
  return false;
}

// Whole days left before the end date (0 on the last day), or null when there is no end date or it has passed.
export function subscriptionDaysLeft(sub: CompanySubscription | null | undefined, now: Date = new Date()): number | null {
  if (!sub?.endsAt) return null;
  const ends = new Date(sub.endsAt).getTime();
  if (Number.isNaN(ends) || ends <= now.getTime()) return null;
  return Math.floor((ends - now.getTime()) / 86_400_000);
}
