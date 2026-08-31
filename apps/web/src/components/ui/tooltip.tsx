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
 * A tooltip is not an overlay: it carries no `data-chord-scope`, unlike
 * everything else anchored in this kit. It takes no focus and contains
 * nothing tabbable, so nothing inside it can consume a keystroke — and
 * marking it `own` would suspend every chord in the app for as long as a
 * pointer happened to rest on a button.
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
 * `Focusable` wraps the trigger because a tooltip must open on keyboard
 * focus as well as hover (WCAG 1.4.13). `delay` defaults to 0 rather than
 * react-aria's 1.5s: this kit's tooltips carry reasons, and a reason a
 * reader has to hover-and-wait for is a reason they will not read.
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
