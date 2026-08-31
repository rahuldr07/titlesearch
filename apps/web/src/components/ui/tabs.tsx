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
import { chordWidget } from "./overlaySurface";
import { disabledAttributes, type Disablement } from "./disabled";

/**
 * Tabs switch a view of the same thing; the five stage tabs on the order bar
 * are the case this is built for. Selection is an accent underline plus
 * weight, never a filled capsule — a fill would spend the once-per-screen
 * accent on navigation.
 *
 * The chord mark is `widget`, not `own`: a Tabs strip is mounted at all
 * times and `own` is read document-wide, so it would make every chord in the
 * app permanently dead. A blocked stage renders disabled with the rule,
 * never hidden — hiding it would silently renumber the stages.
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

/*
 * No BlockedHint on a Tab: react-aria's CollectionBuilder reads its direct
 * element children as data before any of them render, so any wrapper — even
 * a display:contents one — makes the item disappear from the strip. A
 * collection item therefore carries `data-disabled-reason` (and an inline
 * note where the design gives it one) instead of a hover `title`.
 */
export type TabProps = Omit<
  TabPrimitiveProps,
  "isDisabled" | "className" | "children"
> &
  Disablement & { readonly children: ReactNode };

export function Tab({ disabledBecause, children, ...props }: TabProps) {
  return (
    <TabPrimitive
      {...props}
      {...disabledAttributes(disabledBecause)}
      data-slot="tabs-trigger"
      className={cx(
        "tp-state tp-press tp-target tp-ring flex cursor-pointer items-center gap-4 border-b-2 px-4 pb-5",
        "border-transparent font-sans text-meta leading-close font-medium text-ink-secondary",
        "hover:not-data-disabled:text-ink-primary",
        // The stroke, not a fill.
        "data-selected:border-action data-selected:font-semibold data-selected:text-ink-primary",
        "data-disabled:cursor-not-allowed data-disabled:text-ink-disabled",
      )}
    >
      {children}
    </TabPrimitive>
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
