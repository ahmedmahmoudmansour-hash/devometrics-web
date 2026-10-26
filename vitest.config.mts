import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Fast, offline unit tests (npm test). Pure logic and repository hygiene
// checks only: nothing here touches the network or the database. The live
// suite that exercises the real database lives behind vitest.live.config.ts.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "tests/unit/**/*.test.ts"],
    // Loading the Sentry SDK in the monitoring test can take longer than the 10 s default
    // when the whole suite runs at once on a busy machine.
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
