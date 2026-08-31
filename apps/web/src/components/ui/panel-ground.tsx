import type { ReactNode } from "react";

/**
 * The ground a form control actually stands on. Storybook's `backgrounds`
 * global paints the iframe's body, but axe computes contrast against the
 * nearest painted ancestor of the text node — still the app canvas. This
 * decorator paints a real panel: an 11px label is 4.69:1 on panel and
 * 4.04:1 on the canvas, the difference between passing 1.4.3 and failing it.
 */
export function PanelGround({ children }: { readonly children: ReactNode }) {
  return <div className="bg-surface-panel rounded-lg p-12">{children}</div>;
}
