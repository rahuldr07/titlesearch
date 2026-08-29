import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import {
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
   * NO `/api/lifecycle` READ HERE ANY MORE. It fed a `RailCount` on a
   * `/dashboard` door that `doors.ts` does not contain — a fetch nothing
   * rendered. INVARIANT 66 (attention rides the doors as DOTS, never counts)
   * means the count is deleted rather than rehomed onto All Orders.
   *
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
