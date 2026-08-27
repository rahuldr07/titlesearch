import type { Preview } from "@storybook/react-vite";
import "../src/styles/index.css";

/**
 * The tokens load via index.css, so a story renders in the real register — a
 * primitive that only looks right against Storybook's default white would be a
 * primitive nobody had actually checked.
 */
const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: {
      options: {
        app: { name: "app", value: "var(--color-surface-app)" },
        panel: { name: "panel", value: "var(--color-surface-panel)" },
        // Was --color-document-bg, deleted in the 2026-08-27 revaluation: the
        // dark-document ink vocabulary is gone. The two grounds a primitive can
        // now stand on besides the app chrome are PAPER (evidence, rule 8) and
        // the DARK CHROME rail. Both are listed, because a token that only
        // looks right on one of them is the defect this panel exists to catch.
        paper: { name: "paper (evidence)", value: "var(--color-surface-paper)" },
        rail: { name: "dark chrome (rail)", value: "var(--color-rail-surface)" },
      },
    },
    // §6 requires every interactive element to be keyboard reachable with a
    // visible ring. Failing the run (not warning) is what makes that real.
    a11y: { test: "error" },
  },
  initialGlobals: { backgrounds: { value: "app" } },
};

export default preview;
