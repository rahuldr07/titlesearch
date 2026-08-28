import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { ActiveOrderStages as OrderStages } from "./ActiveOrderStages";
import { OrderContextResponse, type GrantedPermissionSchema } from "@titlepipe/contract";
import { get } from "../../shared/api";
import { DOORS, SECTION_RUBRIC, type RailSection } from "./doors";
import { hasDoor } from "../session/permissions";
import { RailCount, RailDot } from "./RailSignal";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuLink,
  SidebarMenuLabel,
} from "../../components/ui";

/**
 * ONE SECTION of the rail — a rubric and the doors under it.
 *
 * Split out of `SideRail.tsx` to stay under the 150-line gate, and the seam is
 * where the data stops: `SideRail` does the FETCHING (the two queries and the
 * permission payload) and this file does the DRAWING. It takes what it prints
 * as props and issues no query of its own, so a section cannot start asking the
 * server for something the rail above it does not know about.
 */

export function Section(props: {
  readonly section: RailSection;
  readonly rules: readonly GrantedPermissionSchema[] | undefined;
  readonly pathname: string;
  readonly total: number | undefined;
  readonly openEscalation: boolean;
}) {
  const doors = DOORS.filter(
    (door) => door.section === props.section && hasDoor(props.rules, door.path),
  );
  // A section whose every door is outside this world is ABSENT too — a rubric
  // over nothing still names a world the reader may not enter.
  if (doors.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel trailing={<ActiveOrderRef section={props.section} />}>
        {SECTION_RUBRIC[props.section]}
      </SidebarGroupLabel>
      <SidebarMenu>
        {doors.map((door) => (
          <SidebarMenuLink
            key={door.path}
            to={door.path}
            testId={`rail-door-${door.path}`}
            // `/` matches exactly; every other door matches its prefix, which
            // is what authz.ts:50 says the path means.
            active={
              door.path === "/"
                ? props.pathname === "/"
                : props.pathname.startsWith(door.path)
            }
          >
            <SidebarMenuLabel>{door.label}</SidebarMenuLabel>
            {door.path === "/dashboard" && props.total !== undefined && (
              <RailCount value={props.total} label={`${props.total} orders`} />
            )}
            {door.path === "/escalations" && props.openEscalation && (
              <RailDot
                path="/escalations"
                tone="attend"
                title="Unresolved escalations are waiting"
              />
            )}
          </SidebarMenuLink>
        ))}
      </SidebarMenu>
      {/*
        * The design's numbered stages, BELOW the door.
        *
        * §App shell: "Active Order (numbered stages 1-5 with state dots)". A
        * door and a stage are different objects — a door is somewhere you may
        * go, a stage is where the work has got to — so the stages sit under
        * the Review door rather than replacing it.
        */}
      {props.section === "order" && <ActiveOrderStages />}
    </SidebarGroup>
  );
}

/**
 * THE ACTIVE ORDER'S REF, beside its rubric — mono and accent, as the design
 * draws it (`4176034-1`, not `ord_demo_1`).
 *
 * THE ID IN THE URL IS NOT THE REF. `/orders/ord_demo_1` carries an opaque
 * primary key, and printing it is the defect `OrderContextResponse` exists to
 * fix — `intake.ts:289-291` records that the strip "printed the opaque
 * `ord_demo_1` where the design says `ORDER 4176034-1`". So this asks the same
 * endpoint the strip does, under the SAME query key, which makes it the same
 * cache entry and not a second request.
 *
 * Until it answers, this renders NOTHING rather than the id: a ref the reader
 * can quote to a client is worth waiting a frame for, and an opaque key
 * flashing into a real ref is a worse read than an empty slot filling.
 *
 * It is only fetched on an order-scoped route, and only for the Active-Order
 * rubric — `enabled` is the guard, so the other two sections never ask.
 */
/** The stages, gated on an order-scoped route exactly as the ref above is. */
function ActiveOrderStages() {
  const orderId = useRouterState({
    select: (s) => /^\/orders\/([^/]+)/.exec(s.location.pathname)?.[1] ?? null,
  });
  if (orderId === null) return null;
  return <OrderStages orderId={orderId} />;
}

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
      data-testid="rail-active-order"
      className="tp-state min-w-0 truncate font-mono text-label font-bold leading-flat text-rail-accent"
    >
      {context.data.order_ref}
    </Link>
  );
}
