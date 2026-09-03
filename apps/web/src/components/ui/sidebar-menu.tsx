import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cx } from "@/components/ui/cx";

/**
 * The sidebar menu — rubric, door list, door, label. The rail is two levels
 * exactly: a rubric and its doors; there is no sub-door level.
 */

/** A rubric plus its doors. */
export function SidebarGroup(props: { readonly children: ReactNode }) {
  return (
    <div data-slot="sidebar-group" className="flex w-full min-w-0 flex-col px-5 pt-10">
      {props.children}
    </div>
  );
}

/**
 * The rubric: 11px, .14em tracking, all-caps — one of exactly two places
 * capitals are legal (the other is a serif certificate heading), and
 * check-rules bans `uppercase` on any line without `text-rail-*` or
 * `font-serif`. `trailing` is the Active-Order slot: the order ref, mono,
 * baseline-aligned to the rubric.
 */
export function SidebarGroupLabel(props: {
  readonly children: ReactNode;
  readonly trailing?: ReactNode;
}) {
  return (
    <div
      data-slot="sidebar-group-label"
      className="flex items-baseline justify-between gap-4 px-4 pb-3"
    >
      <h2 className="text-label font-bold uppercase leading-flat tracking-caps text-rail-ink-muted">
        {props.children}
      </h2>
      {props.trailing}
    </div>
  );
}

/** The door list. `gap-1` is 2px between rows. */
export function SidebarMenu(props: { readonly children: ReactNode }) {
  return (
    <div data-slot="sidebar-menu" className="flex w-full min-w-0 flex-col gap-1">
      {props.children}
    </div>
  );
}

/**
 * A door: 38px tall, radius 14, accent fill when active. The active fill
 * does not count against the once-per-screen accent budget — the rail is
 * chrome beside every screen, and "you are here" is not a decision. A router
 * `Link`, never a button with onClick: that is what makes a door
 * middle-clickable, copyable and a real history entry.
 */
export function SidebarMenuLink(props: {
  readonly to: string;
  readonly active: boolean;
  readonly testId?: string | undefined;
  readonly children: ReactNode;
}) {
  return (
    <Link
      to={props.to}
      data-slot="sidebar-menu-button"
      data-testid={props.testId}
      // No `aria-current` here on purpose: TanStack Router's `Link` sets
      // `aria-current="page"` itself, so the programmatic "you are here" is
      // already served. A second, prop-driven copy would not be redundant but
      // WRONG — `active` is this rail's door-level notion (is this door the
      // SECTION I am in) while the router's is the exact page.
      //
      // `activeOptions.exact` is what makes that second half true. Without it
      // `Link` marks itself current for every DESCENDANT of its href, so the
      // `/orders/{id}` door announced "you are here" while the reader was on
      // `/orders/{id}/extraction` or `/review` — measured at four and five
      // links carrying `aria-current="page"` on one screen. The comment above
      // asserted an exact match that the router was not performing.
      activeOptions={{ exact: true }}
      data-active={props.active}
      className={cx(
        "tp-state tp-press flex h-19 w-full items-center gap-4 overflow-hidden rounded-lg px-6",
        "text-meta leading-flat",
        props.active
          ? "bg-action font-semibold text-ink-on-action"
          // Resting is 400 and active is 600, so weight carries the "you are
          // here" signal alongside the fill.
          : "font-normal text-rail-ink hover:bg-rail-line",
      )}
    >
      {props.children}
    </Link>
  );
}

/**
 * The label inside a door. Truncates rather than wrapping — a wrapped door
 * row breaks the 38px rhythm for the whole list. `min-w-0` is what makes
 * `truncate` work inside a flex row.
 */
export function SidebarMenuLabel(props: { readonly children: ReactNode }) {
  return <span className="min-w-0 flex-1 truncate">{props.children}</span>;
}
