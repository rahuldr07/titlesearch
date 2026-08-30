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

 * THE LEFT RAIL — 240px, on `--color-rail-surface`, full height. INVARIANT 63: a

 * full-height COLUMN, not a page-sticky element.

 */
export function SideRail(props: {
  readonly rules: readonly GrantedPermissionSchema[] | undefined;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  /*
   * ⚠ RULED 2026-08-29 (RULING-2026-08-29.md): the reference rail carries a
   * COUNT on All Orders, a QC pill on Escalations and a version pill on
   * Templates Architect — drawn, so built. This read replaces the
   * escalations-list read the dot used: every ornament arrives FINISHED off
   * `GET /api/rail` (the pill's whole text, the version string), so the rail
   * still counts, captions and formats nothing itself. INVARIANT 66's dot is
   * superseded on these doors by that ruling; the refusal that survives is
   * that no figure here is a rate and none is derived in the browser.
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
 * THE FOLD IS UNBUILT, AND NOT FOR THE REASON THIS COMMENT USED TO GIVE.
 *
 * It said "the fold has no server to write to yet". That was false:
 * `Preferences.nav_collapsed` (`intake.ts`) and `GET`/`PATCH
 * /api/me/preferences` have both existed for some time, and `packages/mocks`
 * serves them. The real reason is that the reference app's rail draws NO fold
 * control, so building one would be inventing an affordance, and
 * `nav_collapsed` is still marked awaiting ratification — the preference it
 * would write is itself provisional.
 *
 * Recorded in `docs/frontend/design-2026-08/CONFLICT-deleted-queue-and-rail-controls.md`
 * §3, which is where `sidebar.spec`'s four red fold tests are accounted for.
 *
 * A named no-op rather than a `useState`: state here would make the rail fold,
 * look finished, and silently forget on every navigation.
 */
const NOT_WIRED = () => {};
