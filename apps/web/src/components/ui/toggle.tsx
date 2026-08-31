import type { ReactNode } from "react";
import { ToggleButton, type ToggleButtonProps } from "react-aria-components";

import { cx } from "./cx";
import { disabledAttributes, type Disablement } from "./disabled";
import { BlockedHint } from "./blockedHint";

/**
 * A control that remembers one bit. The on state is a raised white cell on
 * the sunken track — weight plus elevation, never a fill. BlockedHint
 * carries the `title` react-aria's filterDOMProps strips from composites.
 * No `data-chord-scope` here: a ToggleButton renders as a real <button>,
 * which the chord layer already catches on tagName; the group is what needs
 * the `widget` mark (segmented-control.tsx).
 */
export type ToggleProps = Omit<
  ToggleButtonProps,
  "isDisabled" | "className" | "children"
> &
  Disablement & {
    readonly children: ReactNode;
  };

const toggleClass = cx(
  "tp-state tp-press tp-target tp-ring flex cursor-pointer items-center justify-center gap-3",
  "h-19 px-6 font-sans text-meta leading-close font-medium text-ink-secondary outline-none",
  "hover:not-data-disabled:text-ink-primary",
  // Weight and elevation, never a fill.
  "data-selected:bg-surface-panel data-selected:font-semibold data-selected:text-ink-primary data-selected:shadow-card",
  "data-disabled:cursor-not-allowed data-disabled:text-ink-disabled",
);

export function Toggle({ disabledBecause, children, ...props }: ToggleProps) {
  return (
    <BlockedHint reason={disabledBecause}>
      <ToggleButton
        {...props}
        {...disabledAttributes(disabledBecause)}
        data-slot="toggle"
        className={cx(
          toggleClass,
          "rounded-md border border-control-border bg-control-fill",
        )}
      >
        {children}
      </ToggleButton>
    </BlockedHint>
  );
}
