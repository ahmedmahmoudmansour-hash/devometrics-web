import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const SKIP = new Set(["node_modules", ".next", ".git", "public", "tests", "docs"]);
const EXT = /\.(ts|tsx|js|jsx|mjs|json|sql|md|yml|yaml)$/;

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (EXT.test(name) && st.size < 2_000_000) yield p;
  }
}

// Things that must never be committed. (.env.local is not scanned: it is
// gitignored by design.)
const PATTERNS: [string, RegExp][] = [
  ["Anthropic API key", /sk-ant-[A-Za-z0-9_-]{20,}/],
  ["OpenAI/OpenRouter-style key", /\bsk-(?:or-)?[A-Za-z0-9]{32,}\b/],
  ["Resend API key", /\bre_[A-Za-z0-9]{24,}\b/],
  ["Supabase service-role key reference with a value", /service_role['"]?\s*[:=]\s*['"]eyJ/],
  ["Private key block", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["Hard-coded JWT", /\beyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/],
];

describe("repository hygiene: no committed secrets", () => {
  it("contains no API keys, private keys or hard-coded JWTs in tracked source", () => {
    const hits: string[] = [];
    for (const file of walk(root)) {
      if (file.endsWith("package-lock.json")) continue;
      const text = readFileSync(file, "utf8");
      for (const [label, re] of PATTERNS) {
        if (re.test(text)) hits.push(`${label}: ${file.slice(root.length)}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
