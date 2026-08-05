import type { Preview } from "@storybook/react-vite";
import "../src/index.css";

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
        document: { name: "document pane", value: "var(--color-document-bg)" },
      },
    },
    // §6 requires every interactive element to be keyboard reachable with a
    // visible ring. Failing the run (not warning) is what makes that real.
    a11y: { test: "error" },
  },
  initialGlobals: { backgrounds: { value: "app" } },
};

export default preview;
