import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import {
  RailBadgesResponse,
  type GrantedPermissionSchema,
} from "@titlepipe/contract";
import { get } from "../../shared/api";
import { SECTION_ORDER } from "./doors";
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
 * The left rail — 240px, on `--color-rail-surface`, a full-height column,
 * not a page-sticky element.
 */
export function SideRail(props: {
  readonly rules: readonly GrantedPermissionSchema[] | undefined;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  /*
   * Every rail ornament arrives finished off `GET /api/rail` — the pill's
   * whole text, the version string — so the rail counts, captions and
   * formats nothing itself. No figure here is a rate and none is derived in
   * the browser.
   */
  const rail = useQuery({
    queryKey: ["rail"],
    queryFn: () => get("/api/rail", RailBadgesResponse),
    enabled: props.rules !== undefined,
  });

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
              badges={rail.data}
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
 * The fold is unbuilt: the design draws no fold control, so building one
 * would be inventing an affordance, and the preference it would write is
 * still provisional. A named no-op rather than a `useState` — state here
 * would make the rail fold, look finished, and silently forget on every
 * navigation.
 */
const NOT_WIRED = () => {};
