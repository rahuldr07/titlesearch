import type { ReactNode } from "react";
import {
  Breadcrumb as BreadcrumbPrimitive,
  Breadcrumbs as BreadcrumbsPrimitive,
  Link as LinkPrimitive,
  type BreadcrumbsProps,
  type LinkProps,
} from "react-aria-components";

import { cx } from "./cx";

/**
 * The top-bar breadcrumb chip. react-aria's Breadcrumbs renders a bare <ol>
 * with an aria-label and no landmark role, so the <nav> wrapper here is the
 * only thing that puts the trail in the landmark list — keep it.
 */

export type BreadcrumbTrailProps<T extends object> = Omit<
  BreadcrumbsProps<T>,
  "className" | "aria-label"
> & {
  /** The trail's accessible name, e.g. "Order location". Names the landmark. */
  readonly label: string;
};

/**
 * The trail: a <nav> landmark wrapping react-aria's <ol>. The label goes on
 * the nav — the inner <ol> carries no role, so a label there names nothing a
 * reader can navigate to.
 */
export function BreadcrumbTrail<T extends object>({
  label,
  ...props
}: BreadcrumbTrailProps<T>) {
  return (
    <nav aria-label={label} data-slot="breadcrumb">
      <BreadcrumbsPrimitive
        {...props}
        data-slot="breadcrumb-list"
        className="flex min-w-0 flex-wrap items-center gap-4 font-sans text-meta leading-close text-ink-muted"
      />
    </nav>
  );
}

/** One crumb. The separator lives inside the item rather than as a sibling,
    so a caller cannot leave a trailing one on a single-crumb trail. */
export function BreadcrumbItem({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string | undefined;
}) {
  return (
    <BreadcrumbPrimitive
      data-slot="breadcrumb-item"
      className={cx("inline-flex min-w-0 items-center gap-4", className)}
    >
      {children}
    </BreadcrumbPrimitive>
  );
}

/** The divider. A path separator is punctuation in a path, so mono. */
export function BreadcrumbSeparator() {
  return (
    <span
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className="font-mono text-label leading-flat text-ink-faint"
    >
      /
    </span>
  );
}

/** A crumb you can go back to. `tp-target` gives it the WCAG 2.5.8 hit box. */
export function BreadcrumbLink(props: Omit<LinkProps, "className">) {
  return (
    <LinkPrimitive
      {...props}
      data-slot="breadcrumb-link"
      className={cx(
        "tp-state tp-target tp-ring inline-flex cursor-pointer items-center truncate",
        "font-sans text-meta leading-close text-ink-muted underline-offset-4 outline-none",
        "hover:text-ink-primary hover:underline",
      )}
    />
  );
}

/**
 * Where you are. Text, not a disabled link: `aria-current="page"` on a span
 * is the whole contract for a trail's last crumb.
 */
export function BreadcrumbCurrent({ children }: { readonly children: ReactNode }) {
  return (
    <span
      data-slot="breadcrumb-current"
      aria-current="page"
      className="truncate font-sans text-meta leading-close font-semibold text-ink-primary"
    >
      {children}
    </span>
  );
}
