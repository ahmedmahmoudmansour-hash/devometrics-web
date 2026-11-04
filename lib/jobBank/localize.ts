// Returns the bank in the chosen language. English is the source; Arabic replaces the words only (names, descriptions,
// level texts, role titles and responsibilities) and keeps every key, grade and requirement exactly as in English.
import { AR_BANK, LEVEL_LABEL_AR } from "./ar";
import type { BankFamily } from "./types";

export type BankLanguage = "en" | "ar";

export function isBankLanguage(value: unknown): value is BankLanguage {
  return value === "en" || value === "ar";
}

export function localizeBank(bank: BankFamily[], language: BankLanguage): BankFamily[] {
  if (language === "en") return bank;
  return bank.map((f) => {
    const tr = AR_BANK[f.key];
    if (!tr) return f; // a family without a translation stays in English rather than disappearing
    return {
      ...f,
      name: tr.name,
      description: tr.description,
      competencies: f.competencies.map((c) => {
        const ct = tr.competencies[c.key];
        return ct ? { ...c, name: ct.name, description: ct.description, levels: ct.levels } : c;
      }),
      roles: f.roles.map((r) => {
        const rt = tr.roles[r.key];
        return { ...r, level: LEVEL_LABEL_AR[r.level] ?? r.level, ...(rt ? { title: rt.title, responsibilities: rt.responsibilities } : {}) };
      }),
    };
  });
}
