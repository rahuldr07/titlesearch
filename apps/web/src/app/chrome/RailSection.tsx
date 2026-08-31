import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { ActiveOrderStages as OrderStages } from "./ActiveOrderStages";
import {
  OrderContextResponse,
  type GrantedPermissionSchema,
  type RailBadgesResponse,
} from "@titlepipe/contract";
import { get } from "../../shared/api";
import { DOORS, SECTION_RUBRIC, type RailSection } from "./doors";
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
          // `/` matches exactly; every other door matches its prefix, which
          // is what the authz path means. Hoisted out of the JSX because the
          // glyph needs the same answer — one derivation, not two.
          const active =
            door.path === "/"
              ? props.pathname === "/"
              : props.pathname.startsWith(door.path);
          return (
            <SidebarMenuLink
              key={door.path}
              to={door.path}
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

/** The stages, gated on an order-scoped route exactly as the ref below is. */
function ActiveOrderStages() {
  const orderId = useRouterState({
    select: (s) => /^\/orders\/([^/]+)/.exec(s.location.pathname)?.[1] ?? null,
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
