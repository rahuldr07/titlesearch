import type { ReactNode } from "react";
import {
  ToggleButton,
  ToggleButtonGroup,
  type ToggleButtonGroupProps,
  type ToggleButtonProps,
} from "react-aria-components";

import { cx } from "./cx";
import { disabledAttributes, type Disablement } from "./disabled";
import { BlockedHint } from "./blockedHint";
import { chordWidget } from "./overlaySurface";
import { toggleClass } from "./toggle";

/**
 * A SEGMENTED CONTROL: A FILTER, NOT NAVIGATION — and that is the whole
 * distinction from Tabs. These cells do not own panels; they filter a table
 * that is already on screen, and announcing them as tabs would promise a reader
 * a panel switch that never happens.
 *
 * ══ RULE 5'S ARITHMETIC, WHICH IS THE GEOMETRY OF THIS COMPONENT ════════════
 *
 * The design note reads "a 10px/4px/6px segmented control": a track with a 10px
 * radius holding cells with a 6px one. That is `inner = outer − gap` exactly,
 * with the 4px of padding BEING the gap — three numbers that are one number and
 * two subtractions. Written as `rounded-md` / `p-2` / `rounded-sm` so the
 * relationship survives a redesign of any one of them.
 *
 * The registry did the opposite: a `spacing` prop, an inline `--gap` custom
 * property, and eleven `group-data-[spacing=0]` classes reconstructing joined
 * corners. All of it is gone — the inline style is banned by check-rules.mjs,
 * and a caller-tunable gap is a caller-tunable radius once rule 5's arithmetic
 * is real.
 *
 * ══ THE CHORD MARK IS `widget` ══════════════════════════════════════════════
 *
 * A single ToggleButton needs no mark (it is a real `<button>`; see
 * `toggle.tsx`), but a GROUP has roving arrow-key focus, which makes the arrows
 * and Home/End the group's. `focusRoles.ts` is explicit that `own` would be
 * wrong here for the same reason as Tabs: a filter strip is mounted at all
 * times, and `own` is read document-wide, so it would kill every chord in the
 * app permanently. `widget` is scoped to the active element's ancestors.
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
    /* `BlockedHint` carries the `title` react-aria's `filterDOMProps` drops —
       see `toggle.tsx` and `blockedHint.tsx`. */
    <BlockedHint reason={disabledBecause}>
      <ToggleButton
        {...props}
        {...disabledAttributes(disabledBecause)}
        data-slot="toggle-group-item"
        /* `rounded-sm` = 6 = the track's 10 minus the 4px of padding. Rule 5. */
        className={cx(toggleClass, "rounded-sm")}
      >
        {children}
      </ToggleButton>
    </BlockedHint>
  );
}
