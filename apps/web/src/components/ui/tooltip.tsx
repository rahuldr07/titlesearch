import type * as React from "react";
import type { ReactNode } from "react";
import {
  Focusable,
  Tooltip as TooltipPrimitive,
  TooltipTrigger as TooltipTriggerPrimitive,
  type TooltipProps,
  type TooltipTriggerComponentProps,
} from "react-aria-components";

import { cx } from "./cx";

/** What `Focusable` accepts: exactly one focusable element, not a fragment. */
type FocusableChild = React.ComponentProps<typeof Focusable>["children"];

/**
 * A TOOLTIP IS NOT AN OVERLAY, AND THAT IS THE DECISION IN THIS FILE.
 *
 * It carries NO `data-chord-scope`. Everything else anchored in this kit sets
 * `own`, and the difference is that a tooltip TAKES NO FOCUS: react-aria opens
 * it on hover or on focus of the TRIGGER, never moves the caret into it, and
 * contains nothing tabbable. Nothing inside it can consume a keystroke, so
 * there is nothing for the global vocabulary to stand down for — and marking
 * it `own` would suspend every chord in the app for as long as a pointer
 * happened to rest on a button. The previous kit made this the assertion in
 * its own story: `Tooltip.stories.tsx` checks
 * `querySelector("[data-chord-scope='own']")` is NULL while one is open.
 *
 * ══ ADAPTED FROM THE REGISTRY ═══════════════════════════════════════════════
 *
 * The registry drew `bg-foreground` / `text-background` — an inverted-ink chip,
 * which this register has no token pair for. The dark surface we DO have is
 * CHROME: `--color-rail-deep` with `--color-rail-ink`, measured for exactly
 * this contrast (10.51:1). `rounded-md`(8) → `rounded-md` at OUR value (10, the
 * input rung; a tooltip is control chrome, not a surface). `text-xs` → the
 * 13px meta rung, `z-50` → `tp-z-popup`, and the eight-class
 * `animate-in/zoom-in-95/slide-in-from-*` stack → `tp-enter`, rule 10's single
 * entry curve. Nothing bounces.
 *
 * THE ARROW IS DROPPED. The registry positioned it with an inline `style`
 * callback and a `rotate(45deg)` per placement; `check-rules.mjs` bans inline
 * styles, and an arrow is decoration on a chip that is already anchored and
 * offset — rule 7, "no icon soup", is the same argument one level down.
 */
export type ChipTooltipProps = Omit<TooltipProps, "className" | "children"> & {
  readonly children: ReactNode;
};

export function Tooltip({ offset = 6, children, ...props }: ChipTooltipProps) {
  return (
    <TooltipPrimitive
      {...props}
      offset={offset}
      data-slot="tooltip"
      className={cx(
        "tp-enter tp-z-popup inline-flex w-fit max-w-160 items-center gap-3",
        "rounded-md bg-rail-deep px-6 py-3",
        "font-sans text-meta leading-close text-rail-ink",
      )}
    >
      {children}
    </TooltipPrimitive>
  );
}

/**
 * `Focusable` wraps the trigger because a tooltip must open on KEYBOARD focus
 * as well as hover — WCAG 1.4.13. A trigger that is not focusable gets a
 * tooltip no keyboard reader can ever see, which is the failure mode this
 * wrapper exists to make impossible rather than to document.
 *
 * `delay` defaults to 0 rather than react-aria's 1.5s. This kit's tooltips
 * carry REASONS (rule 9, and `disabled.ts` puts the same sentence on `title`),
 * and a reason a reader has to hover-and-wait for is a reason they will not
 * read.
 */
export type TooltipTriggerProps = Omit<TooltipTriggerComponentProps, "children"> & {
  /**
   * Exactly two children, in order: the TRIGGER and the TOOLTIP. Typed as a
   * fixed-length tuple rather than `ReactNode` so a caller cannot pass one
   * child (a tooltip that never opens) or three (a silently dropped node), and
   * so the trigger's own type is `Focusable`'s — which is what removes the cast
   * that the registry needed `React.Children.toArray` to launder.
   */
  readonly children: readonly [FocusableChild, ReactNode];
};

export function TooltipTrigger({ delay = 0, children, ...props }: TooltipTriggerProps) {
  const [trigger, tooltip] = children;
  return (
    <TooltipTriggerPrimitive delay={delay} {...props}>
      <Focusable>{trigger}</Focusable>
      {tooltip}
    </TooltipTriggerPrimitive>
  );
}
