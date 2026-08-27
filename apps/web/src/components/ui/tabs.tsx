import type { ReactNode } from "react";
import {
  Tab as TabPrimitive,
  TabList as TabListPrimitive,
  TabPanel as TabPanelPrimitive,
  Tabs as TabsPrimitive,
  type TabListProps,
  type TabPanelProps as TabPanelPrimitiveProps,
  type TabProps as TabPrimitiveProps,
  type TabsProps as TabsPrimitiveProps,
} from "react-aria-components";

import { cx } from "./cx";
import { BlockedHint } from "./blockedHint";
import { chordWidget } from "./overlaySurface";
import { disabledAttributes, type Disablement } from "./disabled";

/**
 * TABS SWITCH A VIEW OF THE SAME THING. The five stage tabs on the order bar
 * are the case this is built for.
 *
 * ══ THE SELECTED TAB IS AN UNDERLINE, NOT A FILLED CAPSULE ══════════════════
 *
 * The registry drew `data-selected:bg-background` inside a `bg-muted` track —
 * a filled pill. Rule 1 forbids it: the accent is the only colour in this
 * palette drawn as a solid fill, it is spent ONCE per screen, and a tab strip
 * would spend it on navigation rather than on the open decision. So selection
 * is an accent UNDERLINE (a stroke) plus weight. The registry's whole `variant`
 * axis (`default` = filled track, `line` = underline) collapses to the one
 * that is legal.
 *
 * ══ THE CHORD MARK IS `widget`, NOT `own` ═══════════════════════════════════
 *
 * `focusRoles.ts` records this as the mistake that was nearly made: a Tabs
 * strip is mounted at ALL TIMES, and `own` is read document-wide by
 * `overlayIsUp()`, so marking it `own` would make every chord in the app
 * permanently dead. `widget` is read only against the active element's
 * ancestors. `focusOwnsKeys` also matches `role="tab"` and the `[role='tablist']`
 * ancestor; this is the defence in depth behind both, and it is what catches a
 * tab strip whose focus has landed somewhere react-aria did not put a role.
 *
 * Rule 12 lands here too, which is why `Tab` takes `disabledBecause`: a stage
 * the reader may not open yet renders DISABLED WITH THE RULE, never hidden.
 * Hiding it would also silently renumber the stages.
 */
export type TabsProps = Omit<TabsPrimitiveProps, "className" | "children"> & {
  readonly children: ReactNode;
};

export function Tabs({ children, ...props }: TabsProps) {
  return (
    <TabsPrimitive {...props} data-slot="tabs" className="flex flex-col gap-8">
      {children}
    </TabsPrimitive>
  );
}

export type TabListShellProps = Omit<
  TabListProps<object>,
  "className" | "aria-label"
> & {
  /** The strip's accessible name, e.g. "Order stages". */
  readonly label: string;
};

export function TabList({ label, ...props }: TabListShellProps) {
  return (
    <TabListPrimitive
      {...props}
      {...chordWidget}
      aria-label={label}
      data-slot="tabs-list"
      className="flex items-end gap-8 border-b border-line-strong"
    />
  );
}

export type TabProps = Omit<
  TabPrimitiveProps,
  "isDisabled" | "className" | "children"
> &
  Disablement & { readonly children: ReactNode };

export function Tab({ disabledBecause, children, ...props }: TabProps) {
  return (
    /* `BlockedHint` carries the `title` react-aria's `filterDOMProps` drops
       from a composite — see `blockedHint.tsx`. Rule 9 needs all three
       carriers, and a tooltip alone fails WCAG 2.2 on touch anyway. */
    <BlockedHint reason={disabledBecause}>
      <TabPrimitive
        {...props}
        {...disabledAttributes(disabledBecause)}
        data-slot="tabs-trigger"
        className={cx(
          "tp-state tp-press tp-target tp-ring flex cursor-pointer items-center gap-4 border-b-2 px-4 pb-5",
          "border-transparent font-sans text-meta leading-close font-medium text-ink-secondary",
          "hover:not-data-disabled:text-ink-primary",
          // The stroke, not a fill. Rule 1.
          "data-selected:border-action data-selected:font-semibold data-selected:text-ink-primary",
          "data-disabled:cursor-not-allowed data-disabled:text-ink-disabled",
        )}
      >
        {children}
      </TabPrimitive>
    </BlockedHint>
  );
}

export type TabPanelProps = Omit<TabPanelPrimitiveProps, "className" | "children"> & {
  readonly children: ReactNode;
};

export function TabPanel({ children, ...props }: TabPanelProps) {
  return (
    <TabPanelPrimitive {...props} data-slot="tabs-content" className="outline-none">
      {children}
    </TabPanelPrimitive>
  );
}
