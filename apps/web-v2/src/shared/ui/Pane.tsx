import type { ReactNode } from "react";
import { cn } from "./classNames";

/**
 * A bounded, internally-scrolling region — the frame the export is built from
 * and this app was not.
 *
 * The export roots at `height:100vh;overflow:hidden` and gives every screen
 * body `height:100%;overflow:auto`. The page NEVER scrolls; each region scrolls
 * inside its own box. This app rooted at `min-h-screen` and page-scrolled, which
 * is why Review rendered 3,276px tall against the export's single 1,000px frame,
 * with the sidebar terminating over blank ground and the order counts scrolling
 * away from the order they count.
 *
 * `min-h-0` ON THE BODY IS THE WHOLE POINT. A flex child's default
 * `min-height:auto` refuses to shrink below its content, so a nested scroller
 * grows the page instead of scrolling — silently, with no error and no visual
 * cue until the layout is already wrong. It is the single most forgotten class
 * in a flex layout, so it lives in one component that cannot forget it, and
 * `Pane.test.ts` fails if it is ever removed.
 */
/**
 * Only `PaneBody` ships today, because only `PaneBody` has a caller: `Screen`
 * composes it as every screen's scroller. `Pane`, `PaneHeader` and `PaneFooter`
 * belong to Review's two-pane rebuild and arrive with it — shipping them now
 * would put three more components in the tree with no call site, which is the
 * exact failure this work exists to end (fourteen were found already built and
 * bypassed). Their classes are declared above and proved by the node gate, so
 * the contract is fixed without the dead code.
 */
interface PaneProps {
  children: ReactNode;
  className?: string;
}

/** The classes each slot contributes, exported so they are testable in node. */
/* eslint-disable-next-line react-refresh/only-export-components -- exported so `min-h-0` is provable as a pure value in the node gate; its absence is invisible in a render test because the page only grows once content overflows. */
export const paneClasses = {
  pane: "flex min-h-0 flex-col",
  header: "flex-none",
  /**
   * `min-h-0` — see the note above. Removing it breaks the scroll silently.
   *
   * `relative` is load-bearing for a subtler reason. `overflow-hidden` does NOT
   * clip an absolutely-positioned descendant whose containing block lies
   * outside the clipper — and Tailwind's `sr-only` is `position:absolute`. With
   * no positioned ancestor, every visually-hidden label in the subtree resolved
   * against the INITIAL containing block, escaped the frame, and dragged the
   * document's scroll area out to 3,153px on Review: a page that scrolled
   * 2,150px of blank ground past content that was itself correctly clipped.
   * Nothing was visible, so nothing looked wrong — only the scrollbar knew.
   */
  body: "relative min-h-0 flex-1 overflow-y-auto",
  footer: "flex-none",
} as const;

/** The scroller. Exactly one per pane. */
export function PaneBody({ children, className }: PaneProps) {
  return <div className={cn(paneClasses.body, className)}>{children}</div>;
}
