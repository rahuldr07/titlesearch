import type { ReactNode } from "react";
import {
  Tabs as AriaTabs,
  TabList as AriaTabList,
  Tab as AriaTab,
  TabPanel as AriaTabPanel,
  type TabsProps as AriaTabsProps,
  type TabProps as AriaTabProps,
  type TabPanelProps as AriaTabPanelProps,
} from "react-aria-components";
import { cx } from "./cx";
import { disabledAttributes, type Disablement } from "./disabled";

/**
 * TABS SWITCH A VIEW OF THE SAME THING. The five stage tabs on the order bar
 * (design §App shell) are the case this is built for.
 *
 * The selected tab is marked by an UNDERLINE plus weight, not by a filled
 * capsule. Rule 1 is the reason: a filled tab is a solid fill, the accent is
 * the only solid fill in this palette, and a tab strip would spend the
 * once-per-screen budget on navigation rather than on the decision. The
 * underline is accent-coloured, which is a stroke and not a fill.
 *
 * Rule 12 lands here too, and it is why `Tab` takes `disabledBecause`: a stage
 * the reader may not open yet renders DISABLED WITH THE RULE, never hidden.
 * Hiding it would also silently renumber the stages.
 */
export type TabsProps = Omit<AriaTabsProps, "className" | "children"> & {
  readonly children: ReactNode;
};

export function Tabs({ children, ...props }: TabsProps) {
  return (
    <AriaTabs {...props} className="flex flex-col gap-8">
      {children}
    </AriaTabs>
  );
}

export function TabList({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <AriaTabList aria-label={label} className="flex items-end gap-8 border-b border-line-strong">
      {children}
    </AriaTabList>
  );
}

export type TabProps = Omit<AriaTabProps, "isDisabled" | "className" | "children"> &
  Disablement & { readonly children: ReactNode };

export function Tab({ disabledBecause, children, ...props }: TabProps) {
  return (
    <AriaTab
      {...props}
      {...disabledAttributes(disabledBecause)}
      className={cx(
        "tp-state tp-target tp-ring flex cursor-pointer items-center gap-4 border-b-2 px-4 pb-5",
        "border-transparent font-sans text-meta leading-close font-medium text-ink-secondary",
        "hover:not-data-disabled:text-ink-primary",
        "data-selected:border-action data-selected:font-semibold data-selected:text-ink-primary",
        "data-disabled:cursor-not-allowed data-disabled:text-ink-disabled",
      )}
    >
      {children}
    </AriaTab>
  );
}

export type TabPanelProps = Omit<AriaTabPanelProps, "className" | "children"> & {
  readonly children: ReactNode;
};

export function TabPanel({ children, ...props }: TabPanelProps) {
  return (
    <AriaTabPanel {...props} className="outline-none">
      {children}
    </AriaTabPanel>
  );
}
