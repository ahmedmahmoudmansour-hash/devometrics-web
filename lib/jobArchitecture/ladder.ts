// The career ladder: job families across, grades down, each role shown where it sits with the number of people in it. Pure, so it is
// tested without a database. Rows run over the whole range of grades the company uses, so a missing step in a ladder shows as an
// empty row: that gap is exactly what a development plan has to bridge.

export type LadderFamily = { id: string; name: string };
export type LadderRoleInput = { id: string; familyId: string; title: string; level: string; grade: number; track: "ic" | "management" };
export type LadderRole = LadderRoleInput & { people: number };

export type LadderGrade = {
  grade: number;
  label: string; // the level wording most used at this grade (for example Senior), or ""
  roles: number;
  people: number;
};

export type Ladder = {
  families: LadderFamily[]; // only families that have at least one role, by name
  grades: LadderGrade[]; // highest grade first, every grade from the lowest to the highest in use
  cells: Record<string, Record<number, LadderRole[]>>; // family id -> grade -> roles (people first, then title)
  placedPeople: number;
  unplacedPeople: number;
  maxPeopleInAGrade: number;
};

function commonLabel(labels: string[]): string {
  const counts = new Map<string, number>();
  for (const raw of labels) {
    const l = raw.trim();
    if (l) counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  let best = "";
  let bestN = 0;
  for (const [l, n] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (n > bestN) {
      best = l;
      bestN = n;
    }
  }
  return best;
}

// peopleByRole: how many current members hold each role. totalMembers: everyone counted (so the ones with no role show up too).
export function buildLadder(families: LadderFamily[], roles: LadderRoleInput[], peopleByRole: Record<string, number>, totalMembers: number): Ladder {
  const withPeople: LadderRole[] = roles.map((r) => ({ ...r, people: Math.max(0, Math.floor(peopleByRole[r.id] ?? 0)) }));
  const usedFamilies = new Set(withPeople.map((r) => r.familyId));
  const fams = families.filter((f) => usedFamilies.has(f.id)).sort((a, b) => a.name.localeCompare(b.name));

  const cells: Ladder["cells"] = {};
  for (const r of withPeople) {
    ((cells[r.familyId] ??= {})[r.grade] ??= []).push(r);
  }
  for (const byGrade of Object.values(cells)) for (const list of Object.values(byGrade)) list.sort((a, b) => b.people - a.people || a.title.localeCompare(b.title));

  const gradesInUse = withPeople.map((r) => r.grade);
  const grades: LadderGrade[] = [];
  if (gradesInUse.length > 0) {
    const lo = Math.min(...gradesInUse);
    const hi = Math.max(...gradesInUse);
    for (let g = hi; g >= lo; g--) {
      const atGrade = withPeople.filter((r) => r.grade === g);
      grades.push({ grade: g, label: commonLabel(atGrade.map((r) => r.level)), roles: atGrade.length, people: atGrade.reduce((n, r) => n + r.people, 0) });
    }
  }
  const placedPeople = withPeople.reduce((n, r) => n + r.people, 0);
  return {
    families: fams,
    grades,
    cells,
    placedPeople,
    unplacedPeople: Math.max(0, Math.floor(totalMembers) - placedPeople),
    maxPeopleInAGrade: Math.max(0, ...grades.map((g) => g.people)),
  };
}
