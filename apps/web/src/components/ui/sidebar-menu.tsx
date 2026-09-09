import type { ReactNode } from "react";

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
 * The label inside a door. Truncates rather than wrapping — a wrapped door
 * row breaks the 38px rhythm for the whole list. `min-w-0` is what makes
 * `truncate` work inside a flex row.
 */
export function SidebarMenuLabel(props: { readonly children: ReactNode }) {
  return <span className="min-w-0 flex-1 truncate">{props.children}</span>;
}
