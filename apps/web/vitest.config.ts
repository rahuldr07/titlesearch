import { defineConfig } from "vitest/config";

/**
 * Vitest collects ONLY the static gates (node environment). The e2e/*.spec.ts
 * files are Playwright's — they must never be picked up here.
 */
export default defineConfig({
  test: {
    include: ["vocabulary.test.ts", "authz.test.ts", "noValue.test.ts", "charDiff.test.ts"],
    environment: "node",
  },
});
