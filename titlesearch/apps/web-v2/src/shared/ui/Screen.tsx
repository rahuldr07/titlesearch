import type { ReactNode } from "react";
import type { VariantProps } from "class-variance-authority";
import { screenClasses, screenScroller } from "./screenClasses";
import { cn } from "./classNames";
import { PaneBody } from "./Pane";

/*
 * The MEASURE and PAD vocabulary — every width and every padding pair the
 * screens use, with the reasoning for each — lives in `screenClasses.ts`. It is
 * split out for the reason `Card`, `Button` and `RailRow` split theirs: the
 * vocabulary is a pure function, testable in the node gate without a DOM, and it
 * is longer than the component that spends it.
 */

type MeasureVariants = VariantProps<typeof screenClasses>;
type ScrollerVariants = VariantProps<typeof screenScroller>;

export type ScreenMeasure = NonNullable<MeasureVariants["measure"]>;
/** Local — `Screen` is the only thing that pads a screen. */
type ScreenPad = NonNullable<ScrollerVariants["pad"]>;
/** Local to this file — `Screen` is the only thing that places a screen. */
type ScreenPlacement = NonNullable<MeasureVariants["placement"]>;

export interface ScreenProps {
  children: ReactNode;
  /** Omitted only when `placement` is `bleed`. */
  measure?: ScreenMeasure;
  /** Defaults to `28x32`, the export's value on twelve of the eighteen. */
  pad?: ScreenPad;
  placement?: ScreenPlacement;
  className?: string;
}

/**
 * The scroller is `PaneBody`'s, not a second one. A screen that grew its own
 * `overflow-y-auto` beside the pane's would produce two nested scrollbars, and
 * the outer one would be the page — the exact failure this replaces.
 */
export function Screen({ measure, pad, placement, children, className }: ScreenProps) {
  const bleed = placement === "bleed";
  return (
    <PaneBody className={screenScroller({ placement })}>
      <div className={cn("flex min-h-full min-w-0 flex-col", screenScroller({ pad: bleed ? undefined : (pad ?? "28x32") }), placement === "centre" && "m-auto")}>
        <div className={cn("flex min-w-0 flex-1 flex-col", screenClasses({ measure, placement }), className)}>{children}</div>
      </div>
    </PaneBody>
  );
}
