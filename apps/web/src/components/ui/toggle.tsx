import type { ReactNode } from "react";
import { ToggleButton, type ToggleButtonProps } from "react-aria-components";

import { cx } from "./cx";
import { disabledAttributes, type Disablement } from "./disabled";
import { BlockedHint } from "./blockedHint";

/**
 * A TOGGLE IS A CONTROL THAT REMEMBERS ONE BIT, AND IT IS DRAWN AS ONE.
 *
 * ══ ADAPTED FROM THE REGISTRY ═══════════════════════════════════════════════
 *
 * The registry shipped two variants × three sizes and drew the ON state as
 * `bg-muted` — a filled cell. Rule 1 keeps solid fills for the accent alone, so
 * the ON state here is a raised WHITE cell on the sunken track (weight plus
 * elevation), and a standalone toggle takes the `--color-control-border` chrome
 * an input takes. The size axis is gone: RECIPES.md gives ONE control height
 * (38px), and `h-7`/`h-9` were a scale this design does not have.
 *
 * `rounded-lg`(8) → `rounded-md` (10, the input rung — a toggle is control
 * chrome). `text-sm` → the 13px meta rung. Every `dark:` variant deleted, along
 * with the `aria-invalid:` block: a toggle has no validity state, that was
 * carried over from the registry's shared button base.
 *
 * `BlockedHint` wraps it, and that is MEASURED rather than copied: react-aria
 * runs props through `filterDOMProps`, whose allowlist carries `data-*` and the
 * labelable set but NOT `title` — so `data-disabled-reason` arrives and the
 * HOVER half of rule 9 silently does not. The story caught it. See
 * `blockedHint.tsx`, which the other composites in this kit already use.
 *
 * NO `data-chord-scope` HERE, and that is deliberate. `focusRoles.ts` lists
 * `checkbox` and `switch` in `FOCUSED_ITEM_ROLES` for the single-control
 * reason — "Space, Enter and the arrows are theirs" — and react-aria renders a
 * ToggleButton as a real `<button>` with `aria-pressed`, which the global layer
 * already stands down for on tagName. The GROUP is the thing that needs a mark,
 * because arrow-key roving focus makes it a composite; see `toggle-group.tsx`.
 */
export type ToggleProps = Omit<
  ToggleButtonProps,
  "isDisabled" | "className" | "children"
> &
  Disablement & {
    readonly children: ReactNode;
  };

/** Shared by Toggle and ToggleGroupItem, so the two cannot drift apart. */
export const toggleClass = cx(
  "tp-state tp-press tp-target tp-ring flex cursor-pointer items-center justify-center gap-3",
  "h-19 px-6 font-sans text-meta leading-close font-medium text-ink-secondary outline-none",
  "hover:not-data-disabled:text-ink-primary",
  // Weight and elevation, never a fill. Rule 1.
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
