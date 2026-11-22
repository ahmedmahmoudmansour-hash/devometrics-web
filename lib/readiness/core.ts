// Talent readiness: are people ready for the jobs they hold, where are the gaps, and what should happen next. Pure, so it is tested without a
// database. It reads only what the platform already holds (jobs, who holds them, role-assessment results, development plans); it uses no AI
// and decides nothing about a person: it shows where a conversation is worth having.

export type ReadinessRole = { id: string; title: string; family: string; grade: number };
export type ReadinessMember = { userId: string; name: string; roleId: string | null };
export type ReadinessResult = { versionId: string; status: string; level: number | null; overrideLevel: number | null };
export type ReadinessAssessment = {
  id: string;
  userId: string;
  roleId: string | null;
  status: string; // assigned | in_progress | submitted | scored | scoring_failed
  createdAt: string;
  snapshot: { versionId: string; requiredLevel: number | null }[];
  results: ReadinessResult[];
};

export type ReadinessInput = {
  roles: ReadinessRole[];
  members: ReadinessMember[];
  assessments: ReadinessAssessment[];
  competencyNames: Record<string, string>; // definition version id -> competency name
  plansByUser: Record<string, number>;
};

export type CellState = "met" | "close" | "gap" | "notAssessed";
export type PersonState = "ready" | "close" | "gap" | "notAssessed";

export type CompetencyCell = { name: string; required: number | null; demonstrated: number | null; state: CellState };
export type PersonReadiness = { userId: string; name: string; state: PersonState; competencies: CompetencyCell[] };

export type RoleCompetency = { name: string; required: number; assessed: number; met: number; average: number | null; shortfall: number };
export type RoleReadiness = {
  roleId: string;
  title: string;
  family: string;
  grade: number;
  people: number;
  assessed: number;
  ready: number;
  close: number;
  gap: number;
  readyPercent: number | null; // of the people assessed
  competencies: RoleCompetency[]; // biggest shortfall first
  persons: PersonReadiness[]; // gaps first
};

export type StepKey = "roles" | "placed" | "assessed" | "gaps" | "development";
export type Step = { key: StepKey; done: boolean; current: number; total: number };
export type NextAction = { key: StepKey | "done"; href: string };

export type Readiness = {
  steps: Step[];
  next: NextAction;
  kpis: {
    assessedPeople: number;
    placedPeople: number;
    totalPeople: number;
    readyPercent: number | null;
    biggestGap: { name: string; shortfall: number } | null;
    waiting: number;
  };
  roles: RoleReadiness[];
  peopleWithGaps: number;
};

const demonstrated = (r: ReadinessResult): number | null => (r.status === "scored" ? r.overrideLevel ?? r.level : null);

export function cellState(required: number | null, got: number | null): CellState {
  if (got === null || required === null) return "notAssessed";
  if (got >= required) return "met";
  return required - got === 1 ? "close" : "gap";
}

// The person's overall state from their competencies: ready when every one is met, gap when any is two or more levels short, close otherwise.
export function personState(cells: CompetencyCell[]): PersonState {
  const assessed = cells.filter((c) => c.state !== "notAssessed");
  if (assessed.length === 0) return "notAssessed";
  if (assessed.some((c) => c.state === "gap")) return "gap";
  if (assessed.some((c) => c.state === "close")) return "close";
  return "ready";
}

const rank: Record<PersonState, number> = { gap: 0, close: 1, notAssessed: 2, ready: 3 };

export function computeReadiness(input: ReadinessInput): Readiness {
  const roleById = new Map(input.roles.map((r) => [r.id, r]));
  const placed = input.members.filter((m) => m.roleId && roleById.has(m.roleId));

  // The latest SCORED assessment a person has for the job they hold now.
  const latestScored = new Map<string, ReadinessAssessment>();
  for (const a of input.assessments) {
    if (a.status !== "scored" || !a.roleId) continue;
    const m = input.members.find((x) => x.userId === a.userId);
    if (!m || m.roleId !== a.roleId) continue;
    const have = latestScored.get(a.userId);
    if (!have || a.createdAt > have.createdAt) latestScored.set(a.userId, a);
  }

  const roles: RoleReadiness[] = [];
  for (const role of input.roles) {
    const holders = placed.filter((m) => m.roleId === role.id);
    if (holders.length === 0) continue;
    const persons: PersonReadiness[] = holders.map((m) => {
      const a = latestScored.get(m.userId);
      if (!a) return { userId: m.userId, name: m.name, state: "notAssessed" as const, competencies: [] };
      const byVersion = new Map(a.results.map((r) => [r.versionId, r]));
      const competencies: CompetencyCell[] = a.snapshot.map((s) => {
        const got = byVersion.get(s.versionId) ? demonstrated(byVersion.get(s.versionId) as ReadinessResult) : null;
        return { name: input.competencyNames[s.versionId] ?? "—", required: s.requiredLevel, demonstrated: got, state: cellState(s.requiredLevel, got) };
      });
      return { userId: m.userId, name: m.name, state: personState(competencies), competencies };
    });
    persons.sort((a, b) => rank[a.state] - rank[b.state] || a.name.localeCompare(b.name));

    const byName = new Map<string, { required: number; assessed: number; met: number; sum: number }>();
    for (const p of persons) {
      for (const c of p.competencies) {
        if (c.state === "notAssessed" || c.required === null || c.demonstrated === null) continue;
        const cur = byName.get(c.name) ?? { required: c.required, assessed: 0, met: 0, sum: 0 };
        cur.assessed += 1;
        cur.sum += c.demonstrated;
        if (c.state === "met") cur.met += 1;
        byName.set(c.name, cur);
      }
    }
    const competencies: RoleCompetency[] = [...byName.entries()]
      .map(([name, v]) => {
        const average = v.assessed ? Math.round((v.sum / v.assessed) * 10) / 10 : null;
        return { name, required: v.required, assessed: v.assessed, met: v.met, average, shortfall: average === null ? 0 : Math.max(0, Math.round((v.required - average) * 10) / 10) };
      })
      .sort((a, b) => b.shortfall - a.shortfall || a.name.localeCompare(b.name));

    const assessed = persons.filter((p) => p.state !== "notAssessed").length;
    const ready = persons.filter((p) => p.state === "ready").length;
    roles.push({
      roleId: role.id,
      title: role.title,
      family: role.family,
      grade: role.grade,
      people: persons.length,
      assessed,
      ready,
      close: persons.filter((p) => p.state === "close").length,
      gap: persons.filter((p) => p.state === "gap").length,
      readyPercent: assessed ? Math.round((ready / assessed) * 100) : null,
      competencies,
      persons,
    });
  }
  roles.sort((a, b) => b.people - a.people || a.title.localeCompare(b.title));

  const assessedPeople = roles.reduce((n, r) => n + r.assessed, 0);
  const readyPeople = roles.reduce((n, r) => n + r.ready, 0);
  const peopleWithGaps = roles.reduce((n, r) => n + r.close + r.gap, 0);

  // The competency the people are furthest short on, across every job.
  const overall = new Map<string, { sum: number; n: number }>();
  for (const r of roles) for (const c of r.competencies) if (c.shortfall > 0) overall.set(c.name, { sum: (overall.get(c.name)?.sum ?? 0) + c.shortfall * c.assessed, n: (overall.get(c.name)?.n ?? 0) + c.assessed });
  let biggestGap: Readiness["kpis"]["biggestGap"] = null;
  for (const [name, v] of overall) {
    const shortfall = Math.round((v.sum / v.n) * 10) / 10;
    if (!biggestGap || shortfall > biggestGap.shortfall) biggestGap = { name, shortfall };
  }

  const waiting = input.assessments.filter((a) => ["assigned", "in_progress", "submitted"].includes(a.status)).length;
  // Development counts against the people who have a gap to close, not against everyone.
  const gapsWithPlan = roles.flatMap((r) => r.persons).filter((p) => (p.state === "gap" || p.state === "close") && (input.plansByUser[p.userId] ?? 0) > 0).length;

  const steps: Step[] = [
    { key: "roles", done: input.roles.length > 0, current: input.roles.length, total: input.roles.length },
    { key: "placed", done: input.members.length > 0 && placed.length === input.members.length, current: placed.length, total: input.members.length },
    { key: "assessed", done: placed.length > 0 && assessedPeople === placed.length, current: assessedPeople, total: placed.length },
    { key: "gaps", done: assessedPeople > 0, current: peopleWithGaps, total: assessedPeople },
    { key: "development", done: assessedPeople > 0 && gapsWithPlan >= peopleWithGaps, current: gapsWithPlan, total: peopleWithGaps },
  ];

  const base = "/dashboard/company";
  let next: NextAction = { key: "done", href: `${base}/employees` };
  if (!steps[0].done) next = { key: "roles", href: `${base}/job-architecture` };
  else if (placed.length === 0 || !steps[1].done) next = { key: "placed", href: `${base}/job-architecture#place-people` };
  else if (!steps[2].done) next = { key: "assessed", href: `${base}/role-assessments` };
  else if (peopleWithGaps > 0 && !steps[4].done) next = { key: "development", href: `${base}/employees` };

  return {
    steps,
    next,
    kpis: {
      assessedPeople,
      placedPeople: placed.length,
      totalPeople: input.members.length,
      readyPercent: assessedPeople ? Math.round((readyPeople / assessedPeople) * 100) : null,
      biggestGap,
      waiting,
    },
    roles,
    peopleWithGaps,
  };
}

// A realistic set of made-up people and results, so the page can be shown to a prospective client (and to a new admin) before any real data
// exists. Always labelled as sample data on screen.
export function sampleReadiness(): Readiness {
  const roles: ReadinessRole[] = [
    { id: "r1", title: "Customer Service Manager", family: "Customer Service", grade: 6 },
    { id: "r2", title: "Senior Customer Service Agent", family: "Customer Service", grade: 4 },
    { id: "r3", title: "Finance Analyst", family: "Finance", grade: 4 },
    { id: "r4", title: "HR Business Partner", family: "Human Resources", grade: 5 },
  ];
  const names = ["Layla", "Omar", "Noor", "Khaled", "Sara", "Yousef", "Hana", "Tariq", "Mariam", "Faisal", "Dina", "Rami", "Lina", "Adel"];
  const roleOf = ["r1", "r1", "r2", "r2", "r2", "r2", "r3", "r3", "r3", "r4", "r4", "r4", "r2", "r3"];
  const members: ReadinessMember[] = names.map((name, i) => ({ userId: `u${i}`, name, roleId: roleOf[i] }));
  const comps: Record<string, [string, number][]> = {
    r1: [["Service Quality and Metrics", 5], ["Team Leadership", 4], ["Complaint Handling", 4]],
    r2: [["Customer Communication", 3], ["Complaint Handling", 3], ["Product Knowledge", 3]],
    r3: [["Financial Analysis", 4], ["Reporting", 3], ["Business Partnering", 3]],
    r4: [["Employee Relations", 4], ["Talent Planning", 4], ["HR Analytics", 3]],
  };
  // levels demonstrated, per person (undefined = not assessed yet)
  const got: Record<string, number[] | undefined> = {
    u0: [3, 4, 4], u1: [4, 4, 5], u2: [3, 3, 3], u3: [3, 2, 3], u4: [2, 3, 3], u5: undefined, u6: [4, 3, 3], u7: [3, 3, 3], u8: [4, 3, 4], u9: [4, 4, 3], u10: [3, 3, 3], u11: undefined, u12: [3, 3, 4], u13: undefined,
  };
  const names2: Record<string, string> = {};
  const assessments: ReadinessAssessment[] = [];
  members.forEach((m, i) => {
    const list = comps[m.roleId as string];
    const levels = got[`u${i}`];
    const snapshot = list.map(([n, req], j) => {
      const id = `${m.roleId}-${j}`;
      names2[id] = n;
      return { versionId: id, requiredLevel: req };
    });
    if (!levels) return;
    assessments.push({ id: `a${i}`, userId: m.userId, roleId: m.roleId, status: "scored", createdAt: "2026-11-10", snapshot, results: snapshot.map((s, j) => ({ versionId: s.versionId, status: "scored", level: levels[j], overrideLevel: null })) });
  });
  assessments.push({ id: "w1", userId: "u5", roleId: "r2", status: "assigned", createdAt: "2026-11-12", snapshot: [], results: [] });
  assessments.push({ id: "w2", userId: "u11", roleId: "r4", status: "in_progress", createdAt: "2026-11-13", snapshot: [], results: [] });
  return computeReadiness({ roles, members, assessments, competencyNames: names2, plansByUser: { u0: 1, u3: 1, u4: 1, u2: 1 } });
}
