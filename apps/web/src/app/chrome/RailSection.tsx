import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { ActiveOrderStages as OrderStages } from "./ActiveOrderStages";
import {
  OrderContextResponse,
  type GrantedPermissionSchema,
  type RailBadgesResponse,
} from "@titlepipe/contract";
import { get } from "../../shared/api";
import { queueNext } from "../../shared/queries";
import { DOORS, SECTION_RUBRIC, type RailSection } from "./doors";
import { doorHref, doorIsActive } from "./doorTarget";
import { hasDoor } from "../session/permissions";
import { DoorBadge } from "./DoorBadge";
import { RailGlyph } from "./RailGlyph";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuLink,
  SidebarMenuLabel,
} from "../../components/ui";

/** One section of the rail — a rubric and the doors under it. */

export function Section(props: {
  readonly section: RailSection;
  readonly rules: readonly GrantedPermissionSchema[] | undefined;
  readonly pathname: string;
  readonly badges: RailBadgesResponse | undefined;
}) {
  const orderId = useRailOrderId();
  const doors = DOORS.filter(
    (door) => door.section === props.section && hasDoor(props.rules, door.path),
  );
  // A section whose every door is outside this world is absent too — a rubric
  // over nothing still names a world the reader may not enter.
  if (doors.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel trailing={<ActiveOrderRef section={props.section} />}>
        {SECTION_RUBRIC[props.section]}
      </SidebarGroupLabel>
      <SidebarMenu>
        {doors.map((door) => {
          const active = doorIsActive(door.path, props.pathname);
          return (
            <SidebarMenuLink
              key={door.path}
              to={doorHref(door.path, orderId)}
              testId={`rail-door-${door.path}`}
              active={active}
            >
              <RailGlyph path={door.path} active={active} />
              <SidebarMenuLabel>{door.label}</SidebarMenuLabel>
              {/* Every badge string arrives finished off `GET /api/rail`. */}
              <DoorBadge path={door.path} badges={props.badges} />
            </SidebarMenuLink>
          );
        })}
      </SidebarMenu>
      {/*
       * The numbered stages, below the doors. A door is somewhere you may go
       * and a stage is where the work has got to, so these are two lists on
       * one rhythm rather than one list that conflates them.
       */}
      {props.section === "order" && <ActiveOrderStages />}
    </SidebarGroup>
  );
}

/**
 * The order the rail's order-scoped doors point at: the one already on
 * screen, else the one the server hands out. Never one picked from a list —
 * `/api/queue/next` choosing is what INVARIANT 22 permits, and `/orders-list`
 * stays a separate ops surface.
 */
/** The order the reader is in: the path's, else `/delivery`'s `?order=`. */
function orderInLocation(pathname: string, search: unknown): string | null {
  const routed = /^\/orders\/([^/]+)/.exec(pathname)?.[1];
  if (routed !== undefined) return routed;
  if (typeof search !== "object" || search === null) return null;
  const asked = (search as { order?: unknown }).order;
  return typeof asked === "string" && asked !== "" ? asked : null;
}

function useRailOrderId(): string | null {
  const routed = useRouterState({
    /* The path names it on an order route; `?order=` names it on the one
       order-scoped screen that is not under `/orders` — `/delivery`, which
       has no per-order endpoint to route by. Both are the reader saying
       which order they are in. */
    select: (s) => orderInLocation(s.location.pathname, s.location.search),
  });
  const next = useQuery({
    queryKey: queueNext.key,
    queryFn: () => get(queueNext.path, queueNext.schema),
    enabled: routed === null,
  });
  return routed ?? next.data?.order?.id ?? null;
}

/**
 * The stages, drawn for the order the READER is in — the path's, or
 * `/delivery`'s `?order=`. This used to read the path alone, so arriving on
 * Delivered from an order's own stage strip collapsed the section to a bare
 * heading and read as the order being deselected; `useRailOrderId` (right
 * above) already knew better, and the two disagreed.
 *
 * Still nothing when no order is named. reference-app.html draws its Active
 * Order block unconditionally because the prototype always has one hard-coded
 * order; we refuse, because off an order route the only candidate is whatever
 * `/api/queue/next` hands back, and naming five stages for an order the
 * reader never opened states something untrue.
 */
function ActiveOrderStages() {
  const orderId = useRouterState({
    select: (s) => orderInLocation(s.location.pathname, s.location.search),
  });
  if (orderId === null) return null;
  return <OrderStages orderId={orderId} />;
}

/**
 * The active order's ref, beside its rubric — mono and accent (`4176034-1`,
 * not `ord_demo_1`). The id in the URL is not the ref.
 */
function ActiveOrderRef(props: { readonly section: RailSection }) {
  const orderId = useRouterState({
    select: (s) => /^\/orders\/([^/]+)/.exec(s.location.pathname)?.[1] ?? null,
  });
  const wanted = props.section === "order" && orderId !== null;
  const context = useQuery({
    queryKey: ["orders", orderId, "context"],
    queryFn: () => get(`/api/orders/${orderId}/context`, OrderContextResponse),
    enabled: wanted,
  });
  if (!wanted || context.data === undefined) return null;
  return (
    <Link
      to="/orders"
      /* The ref is a label that happens to be a door, not a page marker.
         Without `exact` it carried `aria-current="page"` on every screen
         beneath `/orders`, so a screen reader met two current items. */
      activeOptions={{ exact: true }}
      data-testid="rail-active-order"
      /*
       * Padded to the 24px WCAG target size rather than given a pseudo-
       * element hit area: axe's `target-size` measures the element's own
       * rect, and a pseudo-element is not in it. `-my-4` then takes the
       * extra height out of flow so the rubric row stays on the shared
       * 17px rhythm while the measured rect stays 24px tall.
       */
      className="tp-state -my-4 flex min-h-12 min-w-0 items-center truncate font-mono text-label font-bold leading-flat text-rail-accent"
    >
      {context.data.order_ref}
    </Link>
  );
}
