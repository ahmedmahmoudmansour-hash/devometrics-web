import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Json = { [key: string]: Json } | string | number | boolean | null | Json[];

function load(file: string): Json {
  return JSON.parse(readFileSync(new URL(`../../messages/${file}`, import.meta.url), "utf8"));
}

function flatten(node: Json, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (node && typeof node === "object" && !Array.isArray(node)) {
    for (const [k, v] of Object.entries(node)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else if (typeof node === "string") {
    out[prefix] = node;
  }
  return out;
}

// ICU variables like {name} / {days, plural, ...} and rich-text tags like
// <strong>...</strong>. A plural branch label such as `one {# day}` is not a
// variable (and Arabic legitimately has more branches than English), so a
// brace group directly after a plural selector is skipped.
const SELECTOR_BEFORE = /(?:=\d+|zero|one|two|few|many|other)\s*$/;
const placeholders = (s: string) =>
  [...s.matchAll(/\{([A-Za-z0-9_]+)[,}]/g)]
    .filter((m) => !SELECTOR_BEFORE.test(s.slice(0, m.index)))
    .map((m) => m[1])
    .sort();
const tags = (s: string) => [...s.matchAll(/<\/?([A-Za-z0-9]+)>/g)].map((m) => m[1]).sort();

describe("translations stay in step (en <-> ar)", () => {
  const en = flatten(load("en.json"));
  const ar = flatten(load("ar.json"));

  it("both locales define exactly the same keys", () => {
    const missingInAr = Object.keys(en).filter((k) => !(k in ar));
    const missingInEn = Object.keys(ar).filter((k) => !(k in en));
    expect({ missingInAr: missingInAr.slice(0, 20), missingInEn: missingInEn.slice(0, 20) }).toEqual({
      missingInAr: [],
      missingInEn: [],
    });
  });

  it("no translation is empty", () => {
    const empty = [...Object.entries(en), ...Object.entries(ar)].filter(([, v]) => v.trim() === "").map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it("every translation keeps the same placeholders and rich-text tags as its English source", () => {
    const mismatched = Object.keys(en)
      .filter((k) => k in ar)
      .filter((k) => JSON.stringify(placeholders(en[k])) !== JSON.stringify(placeholders(ar[k])) || JSON.stringify(tags(en[k])) !== JSON.stringify(tags(ar[k])))
      .slice(0, 20);
    expect(mismatched).toEqual([]);
  });
});
