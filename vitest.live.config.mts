import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";

// Live suite (npm run test:live): exercises the real database and storage as
// real users, to prove tenant isolation, access rules and key flows still
// hold after a migration or release. Opt-in, never part of `npm test`.
//
// Needs, in the environment (or .env.local for the first two):
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
//   TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD     an admin of a throwaway company
//   TEST_MEMBER_EMAIL / TEST_MEMBER_PASSWORD   an ordinary member of that company
// There is a single Supabase project, so these run against production data
// using clearly-labelled throwaway rows that each test removes. See
// tests/README.md.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
    test: {
      environment: "node",
      include: ["tests/live/**/*.test.ts"],
      env: {
        NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
        TEST_ADMIN_EMAIL: process.env.TEST_ADMIN_EMAIL ?? "",
        TEST_ADMIN_PASSWORD: process.env.TEST_ADMIN_PASSWORD ?? "",
        TEST_MEMBER_EMAIL: process.env.TEST_MEMBER_EMAIL ?? "",
        TEST_MEMBER_PASSWORD: process.env.TEST_MEMBER_PASSWORD ?? "",
      },
      testTimeout: 60_000,
      hookTimeout: 60_000,
      // One file at a time: the tests share two accounts and one database.
      fileParallelism: false,
    },
  };
});
