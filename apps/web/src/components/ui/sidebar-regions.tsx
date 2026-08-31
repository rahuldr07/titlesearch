import type { ReactNode } from "react";

/**
 * The three stateless regions of the rail column — header, scroller, footer.
 * sidebar.tsx holds the context and the column.
 */

/** The brand block. Hairline under it. */
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
 * The deep well at the foot — its own tone and a top hairline separate the
 * profile from the doors without a nested card.
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
