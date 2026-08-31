import type { Decorator } from "@storybook/react-vite";

/**
 * The ground a domain component actually stands on: the a11y gate grades
 * contrast against whatever is behind the text, and ink-muted is AA on
 * panel but only 4.04:1 on the app canvas. Every entities/ component is a
 * panel component, so the decorator grades it against the surface it ships
 * on. evidence/ deliberately does not use this — paper is its own surface
 * family.
 */
export const onPanel: Decorator = (Story) => (
  <div className="bg-surface-panel p-12">
    <Story />
  </div>
);

/**
 * The paper ground — same argument as onPanel, opposite surface. The a11y
 * gate then grades the stamp brown against the warm stock it is actually
 * pressed onto, not the canvas where it correctly fails.
 */
export const onPaper: Decorator = (Story) => (
  <div className="bg-surface-paper p-12">
    <Story />
  </div>
);
