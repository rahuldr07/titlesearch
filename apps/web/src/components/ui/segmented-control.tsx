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

/**
 * PORTED FROM apps/web-v2's `SegmentedControl.tsx` — the registry has no
 * equivalent. `toggle-group.tsx` is built on the same single-select
 * `ToggleButtonGroup` primitive; the difference is chrome, not selection
 * model: its cells wear the toggle's dress, these read as a raised white cell
 * on a sunken track.
 *
 * A SEGMENTED CONTROL IS A FILTER, NOT NAVIGATION — the whole distinction from
 * Tabs. Design §Screens 3: the All Orders filter tabs are "a 10px/4px/6px
 * segmented control", i.e. a track with a 10px radius holding cells with a 6px
 * one.
 *
 * That is rule 5's arithmetic exactly: inner = outer − gap, 6 = 10 − 4, with the
 * 4px of padding BEING the gap. The three numbers in the design note are one
 * number and two subtractions, written as `rounded-md` / `p-2` / `rounded-sm`
 * so the relationship survives a redesign of any one of them.
 *
 * `ToggleButtonGroup` in single-selection mode rather than Tabs, because these
 * cells do not own panels — they filter a table already on screen — and
 * announcing them as tabs would promise a reader a panel switch that never
 * happens.
 *
 * Selection is a raised white cell on a sunken track: weight and elevation, no
 * accent. Rule 1 again — a filter is not the screen's decision.
 *
 * `data-chord-scope="widget"` is carried over from the port: the app is
 * chord-driven and arrow keys inside this widget belong to the widget.
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
        data-chord-scope="widget"
        data-slot="segmented-control"
        selectionMode="single"
        disallowEmptySelection
        aria-label={label}
        className="inline-flex gap-1 rounded-md border border-line-strong bg-surface-sunken p-2"
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
  Disablement & { readonly children: ReactNode };

/*
 * NO ITEM-LEVEL `BlockedHint`. `tabs.tsx` documents why an item inside a
 * selection group carries `data-disabled-reason` only: wrapping a collection
 * item is the shape that made a `<Tab>` vanish from its strip, trading rule
 * 12's "never hidden" for rule 9's hover half. A blocked SEGMENT keeps the
 * reason on the data attribute (and its group keeps the group-level wrapper
 * above, so a whole blocked control still states its rule on hover).
 */
export function Segment({ disabledBecause, children, ...props }: SegmentProps) {
  return (
    <ToggleButton
      {...props}
      {...disabledAttributes(disabledBecause)}
      data-slot="segment"
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
