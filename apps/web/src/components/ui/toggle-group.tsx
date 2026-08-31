import type { ReactNode } from "react";
import {
  ToggleButton,
  ToggleButtonGroup,
  type ToggleButtonGroupProps,
  type ToggleButtonProps,
} from "react-aria-components";

import { BlockedHint } from "./blockedHint";
import { cx } from "./cx";
import { disabledAttributes, type Disablement } from "./disabled";
import { chordWidget } from "./overlaySurface";
import { toggleClass } from "./toggle";

/**
 * A filter, not navigation — these cells do not own panels, so announcing
 * them as tabs would promise a panel switch that never happens. The geometry
 * is inner = outer − gap: a radius-10 track, 4px padding, radius-6 cells,
 * written as rounded-md / p-2 / rounded-sm so the relationship survives a
 * redesign of any one of them.
 *
 * The chord mark is `widget`: a single ToggleButton needs no mark (a real
 * <button>; see toggle.tsx), but a group has roving arrow-key focus, and
 * `own` on a permanently-mounted strip would kill every chord in the app.
 */
export type ToggleGroupProps = Omit<
  ToggleButtonGroupProps,
  "className" | "children" | "selectionMode"
> & {
  /** The group's accessible name, e.g. "Order filter". */
  readonly label: string;
  readonly children: ReactNode;
};

export function ToggleGroup({ label, children, ...props }: ToggleGroupProps) {
  return (
    <ToggleButtonGroup
      {...props}
      {...chordWidget}
      selectionMode="single"
      disallowEmptySelection
      aria-label={label}
      data-slot="toggle-group"
      className="inline-flex gap-1 rounded-md border border-line-strong bg-surface-sunken p-2"
    >
      {children}
    </ToggleButtonGroup>
  );
}

export type ToggleGroupItemProps = Omit<
  ToggleButtonProps,
  "isDisabled" | "className" | "children"
> &
  Disablement & { readonly children: ReactNode };

export function ToggleGroupItem({
  disabledBecause,
  children,
  ...props
}: ToggleGroupItemProps) {
  return (
    /*
     * The wrapper is safe on this primitive: unlike the ListBox/Tabs
     * collection builders, ToggleButtonGroup still sees an item through a
     * wrapper element.
     */
    <BlockedHint reason={disabledBecause}>
      <ToggleButton
        {...props}
        {...disabledAttributes(disabledBecause)}
        data-slot="toggle-group-item"
        /* `rounded-sm` = 6 = the track's 10 minus the 4px of padding. */
        className={cx(toggleClass, "rounded-sm")}
      >
        {children}
      </ToggleButton>
    </BlockedHint>
  );
}
