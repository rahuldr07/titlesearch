import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import {
  LifecycleResponse,
  EscalationsResponse,
  type GrantedPermissionSchema,
} from "@titlepipe/contract";
import { get } from "../../shared/api";
import { SECTION_ORDER } from "./doors";
import { hasDoor } from "../session/permissions";
import { RailBrand, RailSearch } from "./RailBrand";
import { Section } from "./RailSection";
import { ProfileBlock } from "./ProfileBlock";
import {
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
} from "../../components/ui";

/**

 * THE LEFT RAIL — 240px, on `--color-rail-surface`, full height. INVARIANT 63: a

 * full-height COLUMN, not a page-sticky element.

 */
export function SideRail(props: {
  readonly rules: readonly GrantedPermissionSchema[] | undefined;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  /*
   * THE SHOP'S VOLUME, and it is the SERVER'S `total` — never `stages` summed
   * or `orders.length`. `intake.ts:218-221`: the order list is scoped to what
   * the caller may see and the census is not, so a count added up in the
   * browser shrinks with your permissions and reads as work disappearing.
   */
  const lifecycle = useQuery({
    queryKey: ["lifecycle"],
    queryFn: () => get("/api/lifecycle", LifecycleResponse),
    enabled: hasDoor(props.rules, "/dashboard"),
  });

  /*
   * WHETHER anything is unresolved — a boolean, deliberately, not a count.
   * INVARIANT 66: attention rides the doors as DOTS, never counts. `.some` is
   * not "re-deriving a count" (INVARIANT 5); it asks whether the list the
   * server sent is empty, which is the only question the dot answers.
   */
  const escalations = useQuery({
    queryKey: ["escalations"],
    queryFn: () => get("/api/escalations", EscalationsResponse),
    enabled: hasDoor(props.rules, "/escalations"),
  });
  const openEscalation =
    escalations.data?.escalations.some((e) => e.resolution === null) ?? false;

  return (
    <SidebarProvider collapsed={false} onCollapsedChange={NOT_WIRED}>
      <Sidebar label="Screens" testId="side-rail">
        <SidebarHeader>
          <RailBrand connected={props.rules !== undefined} />
        </SidebarHeader>
        <SidebarContent>
          <RailSearch />
          {SECTION_ORDER.map((section) => (
            <Section
              key={section}
              section={section}
              rules={props.rules}
              pathname={pathname}
              total={lifecycle.data?.total}
              openEscalation={openEscalation}
            />
          ))}
        </SidebarContent>
        <SidebarFooter>
          <ProfileBlock />
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  );
}

/**

 * The fold has no server to write to yet, and this is the honest spelling of that: a

 * named no-op the TODO above points at. A `useState` here would make the rail fold,

 * look finished, and silently forget on every navigation — a worse…

 */
const NOT_WIRED = () => {};
