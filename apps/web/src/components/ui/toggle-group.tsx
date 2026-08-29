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
    /*
     * `BlockedHint`, and the wrapper is SAFE on this primitive — measured, not
     * assumed. (`segmented-control.tsx`, on the same primitive, has since gone
     * the other way: its items carry `data-disabled-reason` only, aligning
     * with the collection-item convention `tabs.tsx` documents.)
     *
     * This comment previously said the opposite — that `ToggleButtonGroup`
     * builds a collection and a wrapper makes the builder stop seeing the item.
     * That is true of `ListBox` and `Tabs` and NOT of this. Probed with one
     * live and one blocked item in each of the four group controls:
     *
     *     Segment (wrapped)             2 of 2 rendered
     *     ToggleGroupItem (unwrapped)   2 of 2 rendered
     *     RadioGroupItem (wrapped)      2 of 2 rendered
     *     Option (wrapped)              1 of 2 rendered   ← the real case
     *
     * So this component gave up the hover half of rule 9 for a constraint that
     * does not apply to it, while a component built on the identical primitive
     * made the opposite choice. Harmless in the pixels; the danger was the
     * comment, which reads like a finding and would have been copied.
     */
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
