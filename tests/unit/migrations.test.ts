import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dir = new URL("../../supabase/migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const read = (f: string) => readFileSync(new URL(f, dir), "utf8");

describe("migration files", () => {
  it("are numbered consecutively with no gaps or duplicates", () => {
    const numbers = files.map((f) => Number(f.slice(0, 4)));
    expect(files.every((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f))).toBe(true);
    numbers.forEach((n, i) => expect(n).toBe(i + 1));
  });

  // The project rule (CLAUDE skill: devometrics-migrations): every CREATE
  // POLICY must be preceded by DROP POLICY IF EXISTS of the same name on the
  // same table, so a migration can be applied twice. Enforced from the first
  // migration written after the rule was adopted (0150); earlier files are
  // history and are not rewritten.
  it("create policy statements are idempotent (0150 onward)", () => {
    const offenders: string[] = [];
    for (const f of files.filter((f) => Number(f.slice(0, 4)) >= 150)) {
      const sql = read(f).replace(/--.*$/gm, "");
      const creates = [...sql.matchAll(/create\s+policy\s+("[^"]+"|\w+)\s+on\s+([\w."]+)/gi)];
      for (const m of creates) {
        const name = m[1];
        const table = m[2];
        const drop = new RegExp(`drop\\s+policy\\s+if\\s+exists\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+on\\s+${table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
        if (!drop.test(sql)) offenders.push(`${f}: ${name} on ${table}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("SECURITY DEFINER functions set a search_path (0150 onward)", () => {
    const offenders: string[] = [];
    for (const f of files.filter((f) => Number(f.slice(0, 4)) >= 150)) {
      const sql = read(f).replace(/--.*$/gm, "");
      const defs = sql.split(/create\s+(?:or\s+replace\s+)?function\s+/i).slice(1);
      for (const d of defs) {
        const header = d.slice(0, d.search(/\$\$|\$[a-z_]*\$/i) === -1 ? 800 : d.search(/\$\$|\$[a-z_]*\$/i));
        if (/security\s+definer/i.test(header) && !/set\s+search_path/i.test(header)) {
          offenders.push(`${f}: ${header.split("(")[0].trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("PENDING_MIGRATIONS.sql only refers to migrations that exist", () => {
    const pending = readFileSync(new URL("../../supabase/PENDING_MIGRATIONS.sql", import.meta.url), "utf8");
    const header = pending.split("\n").slice(0, 12).join("\n");
    const latest = Number(files[files.length - 1].slice(0, 4));
    const mentioned = [...header.matchAll(/\b0(\d{3})\b/g)].map((m) => Number(m[1]));
    for (const n of mentioned) expect(n).toBeLessThanOrEqual(latest);
  });
});
