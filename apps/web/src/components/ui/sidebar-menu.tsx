import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cx } from "@/components/ui/cx";

/**
 * THE SIDEBAR MENU — the second half of the adapted `sidebar` registry
 * component. `sidebar.tsx` carries the record of what was deleted from the
 * shell; this file carries the record for the menu.
 *
 * ══ THE REGISTRY EXPORTS DELETED HERE, AND WHY ══════════════════════════════
 *
 *   - `SidebarMenuSub` / `SidebarMenuSubItem` / `SidebarMenuSubButton` — a
 *     SECOND nesting level under a door. The design's rail is two levels
 *     exactly: a rubric and its doors. `authz.ts:62-81` is a FLAT door table,
 *     so there is no sub-door for these to draw and no path they could point
 *     at. Three exports, ~60 lines.
 *   - `SidebarMenuAction` — a second, hover-revealed button inside a door row.
 *     Rule 6 allows ONE signal per row, and `md:opacity-0` hides a control
 *     until hover, which is unreachable by keyboard and invisible to touch.
 *   - `SidebarMenuSkeleton` — a loading placeholder whose width is
 *     `Math.random()`. Rule 8 forbids grey placeholder bars, and a rail whose
 *     rows are different lengths on every mount is a rail that flickers. The
 *     doors come from one payload that is either here or not; the rail renders
 *     nothing rather than fake rows.
 *   - `SidebarGroupAction`, `SidebarGroupContent`, `SidebarRail`,
 *     `SidebarTrigger`, `SidebarInput`, `SidebarInset`, `SidebarSeparator` —
 *     see the note in `sidebar-regions.tsx` for the last three.
 *     `SidebarRail` was a 16px invisible drag strip with `cursor-w-resize` that
 *     toggles on CLICK, which is a control that lies about what it does.
 *     `SidebarTrigger` hard-coded `IconPlaceholder`, a create-app scaffold
 *     import that does not exist in this repo.
 *   - `sidebarMenuButtonVariants` (cva, 2 variants x 3 sizes) — collapsed to
 *     one shape. `outline` drew a ring around every door; `sm`/`lg` are 28px
 *     and 48px rows. The design has one door height (38px) and one stage
 *     height (34px), and rule 2 leaves no type size for a 28px row's label.
 *   - `tooltip` on a collapsed button — react-aria `TooltipTrigger` around
 *     every door. Kept OUT deliberately: the collapsed rail is a prop-driven
 *     state this app does not yet serve (see the TODO in `sidebar.tsx`), and a
 *     tooltip that only appears in an unreachable state is untestable.
 */

/** A rubric plus its doors. The registry's `p-2` becomes the design's 20/12. */
export function SidebarGroup(props: { readonly children: ReactNode }) {
  return (
    <div data-slot="sidebar-group" className="flex w-full min-w-0 flex-col px-6 pt-10">
      {props.children}
    </div>
  );
}

/**
 * THE RUBRIC. 11px, .14em, ALL-CAPS — and this is one of exactly two places
 * rule 4 permits capitals (the other is a serif certificate heading).
 * `check-rules.mjs`'s `caps-outside-rubric` bans `uppercase` on any line that
 * does not also carry `text-rail-*` or `font-serif` — legal HERE, and nowhere
 * a screen can copy it from. That sentence used to describe a gate that did
 * not exist; eighteen elements went ALL-CAPS behind it, so the rule was
 * written to match the claim.
 *
 * The registry's version was `text-xs font-medium text-sidebar-foreground/70`
 * on an `h-8` row — sentence case, no tracking, and an opacity-derived colour.
 * `--color-rail-ink-muted` is a measured 5.03:1 value; `/70` on `--color-rail-ink`
 * is 6.4:1 against nothing in particular and moves whenever the ink does.
 *
 * `trailing` is the design's Active-Order slot: the rubric row carries the
 * order ref, mono and accent, baseline-aligned to the rubric.
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

/** The door list. `gap-1` is the design's 2px between rows. */
export function SidebarMenu(props: { readonly children: ReactNode }) {
  return (
    <div data-slot="sidebar-menu" className="flex w-full min-w-0 flex-col gap-1">
      {props.children}
    </div>
  );
}

/**
 * A DOOR. 38px tall, radius 14 (the button recipe), full-bleed accent fill when
 * active — `--color-action` under `--color-ink-on-action`, exactly as the
 * design draws the current screen, and 8.23:1.
 *
 * THIS DOES NOT SPEND RULE 1'S ACCENT. "Once per screen" governs the SCREEN —
 * the open decision or the single primary action — and the rail is chrome that
 * stands beside every screen rather than inside one. The design is explicit
 * about it: its own rail fills the current door with `#5B4B8A` on every screen,
 * including the ones whose primary action is also accent. A door says "you are
 * here", which is not a decision anybody is being asked to make.
 *
 * This is a `Link`, never a `<button>` with an `onClick`. The registry offers
 * both through a `href?: never` union; the design's rail navigates, and a
 * router `Link` is what makes a door middle-clickable, copyable and a real
 * browser history entry. The `ButtonPrimitive` branch is deleted with the
 * union that selected it.
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
      data-active={props.active}
      className={cx(
        "tp-state tp-press flex h-19 w-full items-center gap-5 overflow-hidden rounded-lg px-6",
        "text-meta leading-flat",
        props.active
          ? "bg-action font-semibold text-ink-on-action"
          // 400, not the registry's `font-medium`: the design's resting door is
          // regular weight and its ACTIVE one is 600, so weight is carrying the
          // "you are here" signal alongside the fill. At 500 resting the two
          // states are one step apart and the fill does the work alone.
          : "font-normal text-rail-ink hover:bg-rail-line",
      )}
    >
      {props.children}
    </Link>
  );
}

/**
 * THE LABEL inside a door. Truncates rather than wrapping: a 240px column with
 * a badge on the right cannot fit "Reconciliation" plus a capsule on one line
 * at every zoom level, and a wrapped door row breaks the 38px rhythm for the
 * whole list. `min-w-0` is what makes `truncate` work inside a flex row.
 */
export function SidebarMenuLabel(props: { readonly children: ReactNode }) {
  return <span className="min-w-0 flex-1 truncate">{props.children}</span>;
}
