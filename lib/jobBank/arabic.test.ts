import { describe, expect, it } from "vitest";
import { MAX_LEVEL_INDICATOR_LENGTH } from "@/lib/proficiency/library";
import { JOB_BANK } from "./index";
import { AR_BANK, LEVEL_LABEL_AR } from "./ar";
import { isBankLanguage, localizeBank } from "./localize";
import { validateJobBank } from "./validate";

const ARABIC = /[؀-ۿ]/;
// Short Latin tokens that are genuinely written that way in Arabic business text.
const ALLOWED_LATIN = /DevOps|5S/g;
const hasStrayLatin = (s: string) => /[A-Za-z]/.test(s.replace(ALLOWED_LATIN, ""));

describe("Arabic job bank: completeness", () => {
  it("has a translation for every family, competency and role", () => {
    const missing: string[] = [];
    for (const f of JOB_BANK) {
      const tr = AR_BANK[f.key];
      if (!tr) {
        missing.push(`family ${f.key}`);
        continue;
      }
      for (const c of f.competencies) if (!tr.competencies[c.key]) missing.push(`competency ${c.key}`);
      for (const r of f.roles) if (!tr.roles[r.key]) missing.push(`role ${r.key}`);
    }
    expect(missing).toEqual([]);
  });

  it("has no translation for something that does not exist in English", () => {
    const extra: string[] = [];
    for (const [fk, tr] of Object.entries(AR_BANK)) {
      const f = JOB_BANK.find((x) => x.key === fk);
      if (!f) {
        extra.push(`family ${fk}`);
        continue;
      }
      for (const ck of Object.keys(tr.competencies)) if (!f.competencies.some((c) => c.key === ck)) extra.push(`competency ${ck}`);
      for (const rk of Object.keys(tr.roles)) if (!f.roles.some((r) => r.key === rk)) extra.push(`role ${rk}`);
    }
    expect(extra).toEqual([]);
  });

  it("translates every ladder-step label used", () => {
    const labels = new Set(JOB_BANK.flatMap((f) => f.roles.map((r) => r.level)));
    for (const l of labels) expect(LEVEL_LABEL_AR[l], l).toBeTruthy();
  });
});

describe("Arabic job bank: form", () => {
  const ar = localizeBank(JOB_BANK, "ar");

  it("is written in Arabic, with no stray English", () => {
    const bad: string[] = [];
    const check = (where: string, s: string) => {
      if (!ARABIC.test(s)) bad.push(`${where}: no Arabic`);
      if (hasStrayLatin(s)) bad.push(`${where}: stray Latin letters: ${s}`);
    };
    for (const f of ar) {
      check(`family ${f.key} name`, f.name);
      check(`family ${f.key} description`, f.description);
      for (const c of f.competencies) {
        check(`${c.key} name`, c.name);
        check(`${c.key} description`, c.description);
        c.levels.forEach((l, i) => check(`${c.key} level ${i + 1}`, l));
      }
      for (const r of f.roles) {
        check(`${r.key} title`, r.title);
        check(`${r.key} responsibilities`, r.responsibilities);
        check(`${r.key} level label`, r.level);
      }
    }
    expect(bad).toEqual([]);
  });

  it("passes the same structural rules as English (five different levels, sensible lengths, full stops)", () => {
    // validateJobBank also checks keys, grades and requirements, which are shared with English; the text rules apply to Arabic.
    expect(validateJobBank(ar)).toEqual([]);
    for (const f of ar) for (const c of f.competencies) for (const l of c.levels) expect(l.length).toBeLessThanOrEqual(MAX_LEVEL_INDICATOR_LENGTH);
  });

  it("keeps names unique, because the import matches by name", () => {
    const compNames = ar.flatMap((f) => f.competencies.map((c) => c.name.toLowerCase()));
    expect(new Set(compNames).size).toBe(compNames.length);
    const famNames = ar.map((f) => f.name);
    expect(new Set(famNames).size).toBe(famNames.length);
    for (const f of ar) {
      const titles = f.roles.map((r) => r.title);
      expect(new Set(titles).size, f.name).toBe(titles.length);
    }
  });

  it("changes only the words: keys, grades, tracks and requirements are identical to English", () => {
    JOB_BANK.forEach((f, i) => {
      expect(ar[i].key).toBe(f.key);
      f.roles.forEach((r, j) => {
        expect(ar[i].roles[j].key).toBe(r.key);
        expect(ar[i].roles[j].grade).toBe(r.grade);
        expect(ar[i].roles[j].track).toBe(r.track);
        expect(ar[i].roles[j].technical).toEqual(r.technical);
        expect(ar[i].roles[j].standard).toEqual(r.standard);
      });
      f.competencies.forEach((c, j) => {
        expect(ar[i].competencies[j].key).toBe(c.key);
        expect(ar[i].competencies[j].category).toBe(c.category);
      });
    });
  });

  it("English returns the bank unchanged", () => {
    expect(localizeBank(JOB_BANK, "en")).toBe(JOB_BANK);
  });

  it("recognises only the two supported languages", () => {
    expect(isBankLanguage("en")).toBe(true);
    expect(isBankLanguage("ar")).toBe(true);
    expect(isBankLanguage("fr")).toBe(false);
    expect(isBankLanguage(undefined)).toBe(false);
  });
});
