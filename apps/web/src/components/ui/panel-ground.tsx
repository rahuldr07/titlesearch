import type { ReactNode } from "react";

/**
 * THE GROUND A FORM CONTROL ACTUALLY STANDS ON.
 *
 * Storybook's `backgrounds` global paints the iframe's `<body>`, but axe
 * computes contrast against the nearest painted ANCESTOR of the text node —
 * which for a story rendered into `#storybook-root` is still the app canvas.
 * So the background switcher makes the gallery look right and leaves the a11y
 * gate reading a ground the component would never be placed on.
 *
 * This decorator paints a real panel, which is not a testing trick: RECIPES
 * §Card puts forms inside a white card, and `--color-surface-app` is the
 * canvas BEHIND cards. An 11px label is 4.69:1 on panel and 4.04:1 on the
 * canvas, so the difference between the two grounds is the difference between
 * passing 1.4.3 and failing it. A story that checked the canvas would be
 * failing the kit for an assembly the design forbids.
 */
export function PanelGround({ children }: { readonly children: ReactNode }) {
  return <div className="bg-surface-panel rounded-lg p-12">{children}</div>;
}
