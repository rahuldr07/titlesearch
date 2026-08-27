import type { Decorator } from "@storybook/react-vite";

/**
 * THE GROUND A DOMAIN COMPONENT ACTUALLY STANDS ON.
 *
 * Storybook renders a story on the app canvas by default, and the a11y gate
 * grades contrast against whatever is behind the text. That produced a real
 * failure and a real lesson: `--color-ink-muted` is documented AA "on panel"
 * (tokens.css measures the ink tiers at 15.42:1 / 8.28:1 / 4.63:1 ON PANEL) and
 * it measures 4.04:1 on `--color-surface-app`. Both numbers are correct; the
 * canvas is simply not where these components live.
 *
 * Every component in `entities/` is a PANEL component — it sits inside a card,
 * a row, a well or a decision card, never directly on the canvas. So the
 * decorator puts it there, and the gate then grades it against the surface it
 * will actually ship on. This is not silencing axe; it is giving axe the right
 * question. A component that needs the canvas gets `--color-surface-app` and
 * has to earn its contrast there.
 *
 * `evidence/` deliberately does NOT use this. Paper is its own surface family
 * (rule 8) and a sheet on a white panel has had its point erased.
 */
export const onPanel: Decorator = (Story) => (
  <div className="bg-surface-panel p-12">
    <Story />
  </div>
);
