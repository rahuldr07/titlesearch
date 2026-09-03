import type { ReactNode } from "react";
import {
  ToggleButtonGroup,
  ToggleButton,
  type ToggleButtonGroupProps,
  type ToggleButtonProps,
} from "react-aria-components";
import { cx } from "./cx";
import { disabledAttributes, type Disablement } from "./disabled";
import { BlockedHint } from "./blockedHint";
import { chordWidget } from "./overlaySurface";

/**
 * A segmented control is a filter, not navigation — the whole distinction
 * from Tabs. ToggleButtonGroup in single-selection mode rather than Tabs
 * because these cells do not own panels: announcing them as tabs would
 * promise a reader a panel switch that never happens. Selection is a raised
 * white cell on a sunken track — weight and elevation, no accent.
 *
 * The chord mark is `widget`: a single ToggleButton needs no mark (a real
 * <button>; see toggle.tsx), but a group has roving arrow-key focus, and
 * `own` on a permanently-mounted strip would kill every chord in the app.
 */
export type SegmentedControlProps = Omit<
  ToggleButtonGroupProps,
  "className" | "children" | "selectionMode" | "isDisabled"
> &
  Disablement & {
    readonly label: string;
    readonly children: ReactNode;
  };

export function SegmentedControl({
  label,
  children,
  disabledBecause,
  ...props
}: SegmentedControlProps) {
  return (
    <BlockedHint reason={disabledBecause}>
      <ToggleButtonGroup
        {...props}
        {...disabledAttributes(disabledBecause)}
        {...chordWidget}
        data-slot="segmented-control"
        selectionMode="single"
        disallowEmptySelection
        aria-label={label}
        className="inline-flex gap-2 rounded-lg border border-line-strong bg-surface-panel p-2"
      >
        {children}
      </ToggleButtonGroup>
    </BlockedHint>
  );
}

export type SegmentProps = Omit<
  ToggleButtonProps,
  "isDisabled" | "className" | "children"
> &
  Disablement & {
    readonly children: ReactNode;
    /**
     * Fill the selected segment with the accent instead of lifting it as a
     * white chip. For a strip that IS the screen's subject — the orders
     * filter — where nothing else spends the accent. Never on a screen that
     * already has a primary: RECIPES allows one accent-dominant element.
     */
    readonly accent?: boolean;
  };

/*
 * No item-level BlockedHint: wrapping a collection item is the shape that
 * makes a Tab vanish from its strip (see tabs.tsx), so a blocked segment
 * carries its reason on the data attribute only. The group keeps the
 * group-level wrapper above, so a whole blocked control still states its
 * rule on hover.
 */
export function Segment({ disabledBecause, children, accent = false, ...props }: SegmentProps) {
  return (
    <ToggleButton
      {...props}
      {...disabledAttributes(disabledBecause)}
      data-slot="segment"
      className={cx(
        "tp-state tp-press tp-target tp-ring flex h-16 cursor-pointer items-center justify-center rounded-md px-6",
        "font-sans text-meta leading-close font-medium text-ink-secondary",
        "hover:not-data-disabled:text-ink-primary",
        accent
          ? "data-selected:bg-action data-selected:font-semibold data-selected:text-ink-on-action"
          : "data-selected:bg-surface-sunken data-selected:font-semibold data-selected:text-ink-primary",
        "data-disabled:cursor-not-allowed data-disabled:text-ink-disabled",
      )}
    >
      {children}
    </ToggleButton>
  );
}
