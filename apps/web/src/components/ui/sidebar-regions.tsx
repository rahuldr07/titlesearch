import type { ReactNode } from "react";

/**
 * THE THREE REGIONS of the rail column — header, scroller, footer.
 *
 * Split out of `sidebar.tsx` to stay under the 150-line gate, and the seam is
 * honest rather than arbitrary: `sidebar.tsx` holds the CONTEXT and the column
 * (the parts that carry state), and this file holds three stateless slots that
 * only place children. Neither half reads the other's internals.
 *
 * The registry also shipped `SidebarSeparator`, `SidebarInput` and
 * `SidebarInset` here. All three are DELETED:
 *   - `SidebarSeparator` wrapped `Separator` in `mx-2 bg-sidebar-border`. The
 *     design separates rail regions with a background TONE change (the deep
 *     well) and a border on the region itself, which is what these three do.
 *   - `SidebarInput` was `Input` at `h-8` on `bg-background`. The design's rail
 *     search is a BUTTON that opens the command palette, not a text field —
 *     see `RailSearch` in `app/chrome/`.
 *   - `SidebarInset` styled the `main` beside the rail. `rootRoute.tsx` already
 *     owns that element and its own header explains why it carries no measure.
 */

/** The brand block. Hairline under it, per the design. */
export function SidebarHeader(props: { readonly children: ReactNode }) {
  return (
    <div
      data-slot="sidebar-header"
      className="flex shrink-0 items-center justify-between gap-4 border-b border-rail-line px-10 pt-10 pb-8"
    >
      {props.children}
    </div>
  );
}

/** The scroller. Every group lives in here; the footer does not. */
export function SidebarContent(props: { readonly children: ReactNode }) {
  return (
    <div
      data-slot="sidebar-content"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-8"
    >
      {props.children}
    </div>
  );
}

/**
 * The deep well at the foot (`--color-rail-deep`, a tone below the surface).
 * The registry's footer is `flex-col gap-2 p-2` on the same background; the
 * design gives it its own tone and a top hairline, which is what separates the
 * profile from the doors without a nested card (recipe: nesting forbidden).
 */
export function SidebarFooter(props: { readonly children: ReactNode }) {
  return (
    <div
      data-slot="sidebar-footer"
      data-testid="profile-block"
      className="shrink-0 border-t border-rail-line bg-rail-deep px-8 pt-7 pb-6"
    >
      {props.children}
    </div>
  );
}
