// Rating calibration: how each manager's ratings compare with the company's. Pure functions, no database calls.
//
// Why: in studies of job-performance ratings, who does the rating explains far more of a rating than who is rated
// (Scullen, Mount and Goff 2000). A lenient manager and a severe one are otherwise indistinguishable. This shows the
// pattern so people can talk about it. It does not decide anything and it never forces a distribution.
//
// A flag is a prompt for a conversation, not a finding: a stronger team can deserve higher ratings. A manager with
// fewer than MIN_RATINGS submitted ratings is not shown individually, so a small team never exposes one person.

export const CALIBRATION = {
  // Fewer than this and a manager is counted in the totals but not listed.
  minRatings: 5,
  // A manager's average this far above or below the company average (rating points) is flagged.
  differencePoints: 0.5,
  // A spread (standard deviation) below this means nearly everyone received the same rating.
  narrowSpread: 0.5,
} as const;

export type CalibrationRow = {
  reviewerUserId: string;
  reviewerName: string;
  // Manager's overall rating, 1 to 5.
  rating: number;
  // The employee's own rating of themselves, 1 to 5, when given.
  selfRating: number | null;
};

export type CalibrationFlag = "above_company" | "below_company" | "narrow_spread";

export type ManagerCalibration = {
  reviewerUserId: string;
  name: string;
  count: number;
  mean: number;
  spread: number;
  shareHigh: number; // share rated 4 or 5, 0 to 1
  shareLow: number; // share rated 1 or 2, 0 to 1
  // Average of (manager rating minus self rating) over the reviews where both exist. Null if fewer than 3 such pairs.
  selfGap: number | null;
  flags: CalibrationFlag[];
};

export type CalibrationReport = {
  totalRatings: number;
  companyMean: number | null;
  companySpread: number | null;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  managers: ManagerCalibration[];
  hiddenManagers: number;
  hiddenRatings: number;
};

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

// Sample standard deviation. Zero for fewer than two values.
function spread(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildCalibration(rows: CalibrationRow[]): CalibrationReport {
  const valid = rows.filter((r) => Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5 && r.reviewerUserId);
  const distribution: CalibrationReport["distribution"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of valid) distribution[r.rating as 1 | 2 | 3 | 4 | 5] += 1;

  const all = valid.map((r) => r.rating);
  const companyMean = all.length > 0 ? mean(all) : null;
  const companySpread = all.length > 1 ? spread(all) : null;

  const byManager = new Map<string, CalibrationRow[]>();
  for (const r of valid) {
    const list = byManager.get(r.reviewerUserId);
    if (list) list.push(r);
    else byManager.set(r.reviewerUserId, [r]);
  }

  const managers: ManagerCalibration[] = [];
  let hiddenManagers = 0;
  let hiddenRatings = 0;
  for (const [reviewerUserId, list] of byManager) {
    if (list.length < CALIBRATION.minRatings) {
      hiddenManagers += 1;
      hiddenRatings += list.length;
      continue;
    }
    const ratings = list.map((r) => r.rating);
    const m = mean(ratings);
    const s = spread(ratings);
    const pairs = list.filter((r) => r.selfRating !== null).map((r) => r.rating - (r.selfRating as number));
    const flags: CalibrationFlag[] = [];
    if (companyMean !== null) {
      if (m - companyMean >= CALIBRATION.differencePoints) flags.push("above_company");
      else if (companyMean - m >= CALIBRATION.differencePoints) flags.push("below_company");
    }
    if (s < CALIBRATION.narrowSpread) flags.push("narrow_spread");
    managers.push({
      reviewerUserId,
      name: list[0].reviewerName,
      count: list.length,
      mean: round2(m),
      spread: round2(s),
      shareHigh: ratings.filter((x) => x >= 4).length / ratings.length,
      shareLow: ratings.filter((x) => x <= 2).length / ratings.length,
      selfGap: pairs.length >= 3 ? round2(mean(pairs)) : null,
      flags,
    });
  }
  managers.sort((a, b) => b.mean - a.mean || a.name.localeCompare(b.name));

  return {
    totalRatings: valid.length,
    companyMean: companyMean === null ? null : round2(companyMean),
    companySpread: companySpread === null ? null : round2(companySpread),
    distribution,
    managers,
    hiddenManagers,
    hiddenRatings,
  };
}
