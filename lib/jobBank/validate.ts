// Consistency rules for the bank. Used by the tests, so a careless edit to the content cannot ship a broken bank.
import { COMPETENCY_DIMENSIONS } from "@/lib/gap-analysis/dimensions";
import { COMPETENCY_CATEGORIES, MAX_LEVEL_INDICATOR_LENGTH } from "@/lib/proficiency/library";
import type { BankFamily } from "./types";

const MAX_NAME = 120;
const MAX_DESCRIPTION = 1000;
const MAX_RESPONSIBILITIES = 4000;
const MAX_LEVEL_LABEL = 40;

export function validateJobBank(bank: BankFamily[]): string[] {
  const problems: string[] = [];
  const familyKeys = new Set<string>();
  const familyNames = new Set<string>();
  const competencyKeys = new Set<string>();
  const competencyNames = new Set<string>();
  const roleKeys = new Set<string>();
  const dims = new Set<string>(COMPETENCY_DIMENSIONS);
  const cats = new Set<string>(COMPETENCY_CATEGORIES);

  for (const f of bank) {
    const fk = `family ${f.key}`;
    if (!/^[a-z_]+$/.test(f.key)) problems.push(`${fk}: key must be lowercase letters and underscores`);
    if (familyKeys.has(f.key)) problems.push(`${fk}: duplicate key`);
    familyKeys.add(f.key);
    if (!f.name.trim() || f.name.length > MAX_NAME) problems.push(`${fk}: name length`);
    if (familyNames.has(f.name.toLowerCase())) problems.push(`${fk}: duplicate name`);
    familyNames.add(f.name.toLowerCase());
    if (f.competencies.length < 4) problems.push(`${fk}: needs at least 4 competencies`);
    if (f.roles.length < 4) problems.push(`${fk}: needs at least 4 roles`);

    const own = new Map(f.competencies.map((c) => [c.key, c]));
    const used = new Set<string>();

    for (const c of f.competencies) {
      const ck = `competency ${c.key}`;
      if (!c.key.startsWith(prefix(f.key) + ".")) problems.push(`${ck}: key must start with the family prefix`);
      if (competencyKeys.has(c.key)) problems.push(`${ck}: duplicate key`);
      competencyKeys.add(c.key);
      if (!c.name.trim() || c.name.length > MAX_NAME) problems.push(`${ck}: name length`);
      if (competencyNames.has(c.name.toLowerCase())) problems.push(`${ck}: duplicate name across the bank`);
      competencyNames.add(c.name.toLowerCase());
      if (!cats.has(c.category)) problems.push(`${ck}: unknown category ${c.category}`);
      if (!c.description.trim() || c.description.length > MAX_DESCRIPTION) problems.push(`${ck}: description length`);
      if (c.levels.length !== 5) problems.push(`${ck}: needs exactly five level descriptions`);
      const seen = new Set<string>();
      c.levels.forEach((t, i) => {
        if (!t.trim()) problems.push(`${ck}: level ${i + 1} is empty`);
        if (t.length > MAX_LEVEL_INDICATOR_LENGTH) problems.push(`${ck}: level ${i + 1} is longer than ${MAX_LEVEL_INDICATOR_LENGTH}`);
        if (seen.has(t)) problems.push(`${ck}: level ${i + 1} repeats another level`);
        seen.add(t);
        if (!/[.]$/.test(t.trim())) problems.push(`${ck}: level ${i + 1} should end with a full stop`);
      });
    }

    for (const r of f.roles) {
      const rk = `role ${r.key}`;
      if (!r.key.startsWith(prefix(f.key) + ".")) problems.push(`${rk}: key must start with the family prefix`);
      if (roleKeys.has(r.key)) problems.push(`${rk}: duplicate key`);
      roleKeys.add(r.key);
      if (!r.title.trim() || r.title.length > MAX_NAME) problems.push(`${rk}: title length`);
      if (!r.level.trim() || r.level.length > MAX_LEVEL_LABEL) problems.push(`${rk}: level label length`);
      if (!Number.isInteger(r.grade) || r.grade < 1 || r.grade > 10) problems.push(`${rk}: grade must be 1 to 10`);
      if (r.track !== "ic" && r.track !== "management") problems.push(`${rk}: track`);
      if (!r.responsibilities.trim() || r.responsibilities.length > MAX_RESPONSIBILITIES) problems.push(`${rk}: responsibilities length`);
      const tech = Object.entries(r.technical);
      if (tech.length < 3) problems.push(`${rk}: needs at least 3 technical or functional requirements`);
      for (const [key, level] of tech) {
        if (!own.has(key)) problems.push(`${rk}: requires unknown competency ${key}`);
        used.add(key);
        if (![1, 2, 3, 4, 5].includes(level)) problems.push(`${rk}: level for ${key} must be 1 to 5`);
      }
      for (const [dim, level] of Object.entries(r.standard)) {
        if (!dims.has(dim)) problems.push(`${rk}: unknown standard dimension ${dim}`);
        if (![1, 2, 3, 4, 5].includes(level as number)) problems.push(`${rk}: level for ${dim} must be 1 to 5`);
      }
      const top = Math.max(...tech.map(([, l]) => l));
      if (r.grade <= 2 && top > 3) problems.push(`${rk}: an entry role should not need level ${top} anywhere`);
      if (r.grade >= 7 && top < 4) problems.push(`${rk}: a senior role should need level 4 or 5 somewhere`);
      if (r.track === "management" && r.grade < 4) problems.push(`${rk}: management roles start at grade 4`);
    }

    for (const key of own.keys()) if (!used.has(key)) problems.push(`competency ${key}: no role in the family requires it`);

    const titles = new Set<string>();
    for (const r of f.roles) {
      if (titles.has(r.title.toLowerCase())) problems.push(`role ${r.key}: duplicate title in the family`);
      titles.add(r.title.toLowerCase());
    }
  }
  return problems;
}

// The key prefix of a family: its key, without underscores, to match "hr.", "fin.", "it." and so on is NOT assumed; each
// family file chooses a short prefix. This returns the one the family's own competencies use.
function prefix(familyKey: string): string {
  return PREFIX[familyKey] ?? familyKey;
}

const PREFIX: Record<string, string> = {
  hr: "hr",
  finance: "fin",
  it: "it",
  customer_service: "cs",
  administration: "adm",
  operations: "ops",
  engineering: "eng",
  sales: "sales",
  marketing: "mkt",
  legal: "leg",
  project_management: "pm",
  management: "mgmt",
  data: "data",
  product: "prod",
  retail: "ret",
};
