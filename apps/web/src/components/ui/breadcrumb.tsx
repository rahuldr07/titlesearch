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
 * ADAPTED FROM THE REGISTRY `breadcrumb`. THE DESIGN'S TOP-BAR CHIP.
 *
 * Already on react-aria: `Breadcrumbs` handles the list semantics and
 * `Breadcrumb` exposes `isCurrent`, so the last crumb needs no `aria-current`
 * from a caller who might forget it.
 *
 * ══ SIX THINGS THE REGISTRY SHIPPED, AND WHY THREE ARE GONE ═════════════════
 *
 *   - `Breadcrumb` (the `<nav>`) — KEPT, after being deleted and put back. The
 *     deletion assumed `Breadcrumbs` renders its own landmark. IT DOES NOT,
 *     and a story caught it: react-aria 3.51 renders a bare `<ol>` and merely
 *     puts `aria-label` on it (`private/Breadcrumbs.mjs` → `dom.ol`;
 *     `useBreadcrumbs.mjs` returns `navProps` carrying nothing else). An `<ol>`
 *     has no landmark role, so removing the wrapper removed the trail from the
 *     landmark list entirely. The `<nav>` is the landmark, the `<ol>` the list.
 *   - `BreadcrumbPage` — DELETED. It drew `role="link" aria-disabled="true"`
 *     for the current crumb, a lie twice over: it is not a link, and
 *     `aria-disabled` on a non-interactive element means nothing.
 *   - `BreadcrumbEllipsis` — DELETED with its `MoreHorizontalIcon`. Rule 7
 *     closes the vocabulary to ✓ ◆ • T1 and bans icon soup, and this app's
 *     trail is at most three deep, so the collapse affordance solves a problem
 *     the design does not have.
 *   - The `ChevronRightIcon` separator — REPLACED by a `/` in mono. A path
 *     separator is punctuation rather than a picture of punctuation, and it
 *     costs no icon import.
 *
 * The registry's `text-sm`, `text-muted-foreground`, `hover:text-foreground`
 * and `size-3.5` are re-pointed: rule 2 has no `sm` and this palette no
 * `foreground`. `text-meta` (13px), `text-ink-muted`, `text-ink-primary`.
 *
 * ══ THE `render` PROP AND THE TYPECHECK ERROR IT CAUSED ═════════════════════
 *
 * The raw file destructured `render` off `LinkProps` and passed it back
 * explicitly, which under `exactOptionalPropertyTypes` is a type error: pulling
 * an optional prop out of a spread widens it to `T | undefined`, which
 * `render?: T` refuses. It was pointless too — `{...props}` already carries it.
 */

export type BreadcrumbTrailProps<T extends object> = Omit<
  BreadcrumbsProps<T>,
  "className" | "aria-label"
> & {
  /** The trail's accessible name, e.g. "Order location". Names the landmark. */
  readonly label: string;
};

/**
 * The trail: a `<nav>` landmark wrapping react-aria's `<ol>`.
 *
 * The label is on the NAV, not on the list. A landmark's name is what a reader
 * jumps to it by, and putting it on the inner `<ol>` — which carries no role —
 * names nothing they can navigate to. React-aria still defaults the list's own
 * `aria-label` to "Breadcrumbs", which is inert on a plain list and is left
 * alone rather than fought.
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

/** One crumb. The separator lives INSIDE the item rather than as a sibling, so
    a caller interleaving them by hand cannot leave a trailing one on a
    single-crumb trail. */
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

/** The divider. Rule 3: a path separator is punctuation in a path, so mono. */
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
 * Where you are. Text, not a disabled link. `aria-current="page"` is the whole
 * contract for a trail's last crumb and it belongs on a `<span>` — the registry
 * put it on something claiming `role="link"`, which tells a reader they can
 * activate the place they already are.
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
