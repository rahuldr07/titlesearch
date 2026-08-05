import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "./classNames";

/**
 * The design draws two tab treatments and they are not interchangeable.
 *
 *  - `inset` — an inset segmented control on a sunken track. Used where the
 *    tabs switch a VIEW of the same thing (top nav, role switch). The 2px gap
 *    between the 7px track radius and the 5px item radius is what makes the
 *    active item read as sitting inside the track rather than on top of it.
 *  - `standalone` — free-standing bordered buttons. Used where the tabs switch
 *    WHICH thing you are looking at (client tabs, config tabs).
 *
 * Selected is a fill swap to action + white in both — the same selection
 * language the design uses for pills, option cards and the page strip.
 */
const list = cva("flex", {
  variants: {
    variant: {
      inset: "inline-flex gap-1 rounded-6 border border-line-strong bg-surface-app p-2",
      standalone: "flex-wrap gap-3",
    },
  },
  defaultVariants: { variant: "inset" },
});

const tab = cva(
  ["font-semibold whitespace-nowrap transition-none", "disabled:cursor-not-allowed disabled:text-ink-muted"],
  {
    variants: {
      variant: {
        inset: [
          "rounded-4 px-5 py-3 text-sm text-ink-secondary",
          "data-active:bg-surface-panel data-active:text-action",
        ],
        standalone: [
          "rounded-6 border border-line-strong bg-surface-panel px-7 py-4 text-sm text-ink-secondary",
          "data-active:border-action data-active:bg-action data-active:text-ink-on-action",
        ],
      },
    },
    defaultVariants: { variant: "inset" },
  },
);

type Variant = NonNullable<VariantProps<typeof tab>["variant"]>;

export interface TabsProps {
  children: ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export function Tabs({ className, ...rest }: TabsProps) {
  return <BaseTabs.Root className={className} {...rest} />;
}

export function TabList({
  variant = "inset",
  className,
  children,
}: {
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <BaseTabs.List className={cn(list({ variant }), className)}>{children}</BaseTabs.List>
  );
}

export function Tab({
  variant = "inset",
  value,
  disabled,
  className,
  children,
}: {
  variant?: Variant;
  value: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <BaseTabs.Tab
      value={value}
      disabled={disabled}
      className={cn(tab({ variant }), className)}
    >
      {children}
    </BaseTabs.Tab>
  );
}

export function TabPanel({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <BaseTabs.Panel value={value} className={cn("mt-8", className)}>
      {children}
    </BaseTabs.Panel>
  );
}
