import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { ActiveOrderStages as OrderStages } from "./ActiveOrderStages";
import {
  OrderContextResponse,
  type GrantedPermissionSchema,
} from "@titlepipe/contract";
import { get } from "../../shared/api";
import { DOORS, SECTION_RUBRIC, type RailSection } from "./doors";
import { hasDoor } from "../session/permissions";
import { RailCount, RailDot } from "./RailSignal";
import { RailGlyph } from "./RailGlyph";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuLink,
  SidebarMenuLabel,
} from "../../components/ui";

/**

 * ONE SECTION of the rail — a rubric and the doors under it. Split out of

 * `SideRail.tsx` for the 150-line gate; the seam is where the data stops.

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
        {doors.map((door) => {
          // `/` matches exactly; every other door matches its prefix, which is
          // what authz.ts:50 says the path means. Hoisted out of the JSX because
          // the GLYPH needs the same answer — one derivation, not two.
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
          );
        })}
      </SidebarMenu>
      {/*
       * The design's numbered stages, BELOW the door — §App shell, "Active Order
       * (numbered stages 1-5 with state dots)". A door is somewhere you may go
       * and a stage is where the work has got to: two different objects, so the
       * stages sit under the Review door rather than replacing it.
       */}
      {props.section === "order" && <ActiveOrderStages />}
    </SidebarGroup>
  );
}

/**

 * THE ACTIVE ORDER'S REF, beside its rubric — mono and accent, as the design draws it

 * (`4176034-1`, not `ord_demo_1`). THE ID IN THE URL IS NOT THE REF.

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
      /*
       * WCAG 2.2 §2.5.8 wants a 24px target; this is 11px mono text and was
       * 63x11. Padded rather than given the `after:-inset` pseudo-element the
       * kit uses on checkbox and switch: that mechanism is right for a control
       * whose DRAWN box must stay 16px, and it was tried here first — axe still
       * failed it, because `target-size` measures the element's own rect and
       * the pseudo-element is not in it. A rail row has no drawn box to protect,
       * so the honest fix is for the link to actually be that tall.
       * AND THE RUBRIC ROW GREW WITH IT — 30px here against 17px for the other
       * two, since a 24px flex child sets the line's cross size. The design
       * draws all three rubrics on one rhythm, so `-my-4` takes that height OUT
       * OF FLOW: a margin sits outside the border box, so the rect `target-size`
       * measures is still 63x24 and only the row returns to 17px.
       */
      className="tp-state -my-4 flex min-h-12 min-w-0 items-center truncate font-mono text-label font-bold leading-flat text-rail-accent"
    >
      {context.data.order_ref}
    </Link>
  );
}
