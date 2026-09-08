import type { Decorator } from "@storybook/react-vite";

/**
 * The ground a primitive actually stands on: the a11y addon grades contrast
 * against whatever is behind the text, and ink-muted is AA on panel but only
 * 4.04:1 on the bare canvas. A local copy rather than an import from
 * entities/ — the kit does not depend on the layer above it.
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
