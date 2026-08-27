import type { ReactNode } from "react";
import {
  ToggleButtonGroup,
  ToggleButton,
  type ToggleButtonGroupProps,
  type ToggleButtonProps,
} from "react-aria-components";
import { cx } from "./cx";
import { disabledAttributes, type Disablement } from "./disabled";

/**
 * A SEGMENTED CONTROL IS A FILTER, NOT NAVIGATION — and that is the whole
 * distinction from Tabs. Design §Screens 3: the All Orders filter tabs are "a
 * 10px/4px/6px segmented control", i.e. a track with a 10px radius holding
 * cells with a 6px one.
 *
 * That is rule 5's arithmetic exactly: inner = outer − gap, 6 = 10 − 4, with
 * the 4px of padding BEING the gap. The three numbers in the design note are
 * one number and two subtractions, and they are written as `rounded-md` /
 * `p-2` / `rounded-sm` below so the relationship survives a redesign of any one
 * of them.
 *
 * `ToggleButtonGroup` in single-selection mode rather than Tabs, because these
 * cells do not own panels — they filter a table that is already on screen — and
 * announcing them as tabs would promise a reader a panel switch that never
 * happens.
 *
 * Selection is a raised white cell on a sunken track: weight and elevation, no
 * accent. Rule 1 again — a filter is not the screen's decision.
 */
export type SegmentedControlProps = Omit<
  ToggleButtonGroupProps,
  "className" | "children" | "selectionMode"
> & {
  readonly label: string;
  readonly children: ReactNode;
};

export function SegmentedControl({ label, children, ...props }: SegmentedControlProps) {
  return (
    <ToggleButtonGroup
      {...props}
      data-chord-scope="widget"
      selectionMode="single"
      disallowEmptySelection
      aria-label={label}
      className="inline-flex gap-1 rounded-md border border-line-strong bg-surface-sunken p-2"
    >
      {children}
    </ToggleButtonGroup>
  );
}

export type SegmentProps = Omit<ToggleButtonProps, "isDisabled" | "className" | "children"> &
  Disablement & { readonly children: ReactNode };

export function Segment({ disabledBecause, children, ...props }: SegmentProps) {
  return (
    <ToggleButton
      {...props}
      {...disabledAttributes(disabledBecause)}
      className={cx(
        "tp-state tp-press tp-target tp-ring flex cursor-pointer items-center justify-center rounded-sm px-6",
        "font-sans text-meta leading-close font-medium text-ink-secondary",
        "hover:not-data-disabled:text-ink-primary",
        "data-selected:bg-surface-panel data-selected:font-semibold data-selected:text-ink-primary data-selected:shadow-card",
        "data-disabled:cursor-not-allowed data-disabled:text-ink-disabled",
      )}
    >
      {children}
    </ToggleButton>
  );
}
