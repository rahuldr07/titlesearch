import type { Decorator } from "@storybook/react-vite";

/**
 * THE GROUND A PRIMITIVE ACTUALLY STANDS ON.
 *
 * Same argument as `entities/panelGround.tsx`, restated for the kit: Storybook
 * renders on the app canvas by default and the a11y addon grades contrast
 * against whatever is behind the text. `--color-ink-muted` is documented AA "on
 * panel" (15.42 / 8.28 / 4.63:1 ON PANEL) and measures 4.04:1 on
 * `--color-surface-app`. Both numbers are right; the canvas is simply not where
 * these live. This is not silencing axe, it is asking axe the right question.
 *
 * A local copy rather than an import from `entities/`: the kit does not depend
 * on the layer above it, and check-rules bans cross-feature reach anyway.
 */
export const onPanel: Decorator = (Story) => (
  <div className="bg-surface-panel p-12">
    <Story />
  </div>
);

/** The canvas. For the objects that genuinely sit on it — cards. */
export const onCanvas: Decorator = (Story) => (
  <div className="bg-surface-app p-12">
    <Story />
  </div>
);
