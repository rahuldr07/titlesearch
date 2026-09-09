import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { sidebarDoorClass } from "../../components/ui";

/**
 * A rail door. The look is the kit's (`sidebarDoorClass`); the routing is
 * this layer's, because `components/ui` may not import the route tree —
 * the same split as `LinkButton` (plain `href`) against `RouteButton`.
 *
 * A router `Link`, never a button with onClick: that is what makes a door
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
      className={sidebarDoorClass(props.active)}
    >
      {props.children}
    </Link>
  );
}
