// Adding up a team's knowledge-check results: where the team is strong or weak, competency by competency, and how each person did.
// Pure, so it is tested without a database. Each person counts once, through their most recent finished check, so someone retaking
// a check does not weigh more than someone who did not.
import { readPercent, type CheckResult, type Reading } from "./engine";
import type { Timing } from "./timer";

export type TeamInputRow = {
  checkId: string;
  userId: string;
  name: string;
  roleTitle: string;
  submittedAt: string; // ISO
  result: CheckResult;
  timing: Timing | null;
};

export type TeamCompetency = {
  competencyKey: string;
  asked: number;
  correct: number;
  percent: number;
  reading: Reading;
  people: number; // how many people were asked about it
};

export type TeamPerson = { checkId: string; userId: string; name: string; roleTitle: string; submittedAt: string; percent: number; reading: Reading; timing: Timing | null };

export type TeamResults = {
  people: TeamPerson[]; // best score first
  competencies: TeamCompetency[]; // weakest first
  averagePercent: number | null;
  counts: Record<Reading, number>;
};

export function aggregateTeam(rows: TeamInputRow[]): TeamResults {
  // One check per person: the most recent.
  const latest = new Map<string, TeamInputRow>();
  for (const r of rows) {
    const have = latest.get(r.userId);
    if (!have || r.submittedAt > have.submittedAt) latest.set(r.userId, r);
  }
  const picked = [...latest.values()];

  const people: TeamPerson[] = picked
    .map((r) => ({ checkId: r.checkId, userId: r.userId, name: r.name, roleTitle: r.roleTitle, submittedAt: r.submittedAt, percent: r.result.percent, reading: readPercent(r.result.percent), timing: r.timing }))
    .sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name));

  const byCompetency = new Map<string, { asked: number; correct: number; people: Set<string> }>();
  for (const r of picked) {
    for (const c of r.result.perCompetency) {
      if (c.asked <= 0) continue;
      const cur = byCompetency.get(c.competencyKey) ?? { asked: 0, correct: 0, people: new Set<string>() };
      cur.asked += c.asked;
      cur.correct += c.correct;
      cur.people.add(r.userId);
      byCompetency.set(c.competencyKey, cur);
    }
  }
  const competencies: TeamCompetency[] = [...byCompetency.entries()]
    .map(([competencyKey, v]) => {
      const percent = Math.round((v.correct / v.asked) * 100);
      return { competencyKey, asked: v.asked, correct: v.correct, percent, reading: readPercent(percent), people: v.people.size };
    })
    .sort((a, b) => a.percent - b.percent || a.competencyKey.localeCompare(b.competencyKey));

  const counts: Record<Reading, number> = { strong: 0, adequate: 0, gaps: 0 };
  for (const p of people) counts[p.reading] += 1;
  const averagePercent = people.length ? Math.round(people.reduce((n, p) => n + p.percent, 0) / people.length) : null;
  return { people, competencies, averagePercent, counts };
}
