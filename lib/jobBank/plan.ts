// What an import from the job bank has to create, given what the company already has. Pure, so the rules are tested
// without a database. Running it twice changes nothing: anything already there (matched by name, ignoring case) is kept
// exactly as the company has it, and never overwritten.

import { scoreForLevel } from "@/lib/proficiency/levels";
import type { BankCompetency, BankFamily, BankRole, Level } from "./types";

export type Selection = { familyKey: string; roleKeys: string[] }[];

export type Existing = {
  familyNames: string[];
  competencyNames: string[];
  // "family name (lowercase)" -> role titles (lowercase) already in that family
  rolesByFamily: Record<string, string[]>;
};

export type ImportPlan = {
  familiesToCreate: BankFamily[];
  familiesExisting: string[];
  competenciesToCreate: BankCompetency[];
  competenciesExisting: string[];
  // Roles to create, with the family they belong to. Existing roles are left alone, including their requirements.
  rolesToCreate: { familyKey: string; role: BankRole }[];
  rolesExisting: string[];
  unknown: string[];
};

const norm = (s: string) => s.trim().toLowerCase();

export function planImport(bank: BankFamily[], selection: Selection, existing: Existing): ImportPlan {
  const familyNames = new Set(existing.familyNames.map(norm));
  const compNames = new Set(existing.competencyNames.map(norm));
  const plan: ImportPlan = { familiesToCreate: [], familiesExisting: [], competenciesToCreate: [], competenciesExisting: [], rolesToCreate: [], rolesExisting: [], unknown: [] };
  const wantedComps = new Map<string, BankCompetency>();
  const seenFamilies = new Set<string>();

  for (const sel of selection) {
    const fam = bank.find((f) => f.key === sel.familyKey);
    if (!fam) {
      plan.unknown.push(sel.familyKey);
      continue;
    }
    const roleKeys = [...new Set(sel.roleKeys)];
    const roles: BankRole[] = [];
    for (const rk of roleKeys) {
      const r = fam.roles.find((x) => x.key === rk);
      if (r) roles.push(r);
      else plan.unknown.push(rk);
    }
    if (roles.length === 0) continue;

    if (!seenFamilies.has(fam.key)) {
      seenFamilies.add(fam.key);
      if (familyNames.has(norm(fam.name))) plan.familiesExisting.push(fam.name);
      else plan.familiesToCreate.push(fam);
    }
    const haveRoles = new Set((existing.rolesByFamily[norm(fam.name)] ?? []).map(norm));
    for (const r of roles) {
      if (haveRoles.has(norm(r.title))) {
        plan.rolesExisting.push(r.title);
        continue;
      }
      plan.rolesToCreate.push({ familyKey: fam.key, role: r });
      for (const key of Object.keys(r.technical)) {
        const c = fam.competencies.find((x) => x.key === key);
        if (c) wantedComps.set(c.key, c);
      }
    }
  }

  for (const c of wantedComps.values()) {
    if (compNames.has(norm(c.name))) plan.competenciesExisting.push(c.name);
    else plan.competenciesToCreate.push(c);
  }
  return plan;
}

// The requirement rows for one new role, in the 0 to 100 scale the platform stores (the middle of the chosen level's band).
export function requirementRows(
  role: BankRole,
  competencyIdByKey: Map<string, string>,
  competencyKeyOrder: string[]
): { dimension?: string; competencyId?: string; targetLevel: number }[] {
  const rows: { dimension?: string; competencyId?: string; targetLevel: number }[] = [];
  for (const key of competencyKeyOrder) {
    const level = role.technical[key] as Level | undefined;
    const id = competencyIdByKey.get(key);
    if (level && id) rows.push({ competencyId: id, targetLevel: scoreForLevel(level) });
  }
  for (const [dimension, level] of Object.entries(role.standard)) {
    if (level) rows.push({ dimension, targetLevel: scoreForLevel(level as Level) });
  }
  return rows;
}
