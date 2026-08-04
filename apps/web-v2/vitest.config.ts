import { defineConfig } from "vitest/config";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
// Vitest 4 takes a provider FACTORY, not the string "playwright".
import { playwright } from "@vitest/browser-playwright";
import tailwindcss from "@tailwindcss/vite";

/**
 * Two projects, deliberately separate.
 *
 * `gates` — the harvested static INVARIANTS (test-harvest.md §11), node env:
 *   authz.test.ts (21) over packages/contract, vocabulary.test.ts (1) over src/.
 *   Neither touches the DOM. These 22 must stay green independently of anything
 *   Storybook does, so they never share a project with browser tests.
 *
 * `storybook` — every *.stories.tsx run as a real browser test, with the a11y
 *   addon set to `error` in preview.ts. This is what makes BRIEF §6's "every
 *   interactive element keyboard reachable, axe on Storybook" a gate rather
 *   than an intention.
 *
 * The e2e/**\/*.spec.ts files are Playwright's and must never be collected here.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "gates",
          include: [
            "vocabulary.test.ts",
            "authz.test.ts",
            // Pure-logic entity tests. Kept DOM-free on purpose so rules like
            // no-value exhaustiveness are provable without a browser.
            "src/**/*.test.ts",
          ],
          environment: "node",
        },
      },
      {
        plugins: [tailwindcss(), storybookTest({ configDir: ".storybook" })],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
