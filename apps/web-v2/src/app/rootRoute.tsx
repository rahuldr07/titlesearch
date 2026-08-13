import { createRootRoute, Outlet } from "@tanstack/react-router";
import { GlobalKeys } from "./chrome/GlobalKeys";
import { AppChrome } from "./chrome/AppChrome";
import { OrderStrip } from "./chrome/OrderStrip";
import { NotFound } from "./chrome/Placeholders";

/**
 * Routes are guards and wiring only — no logic (BRIEF §7).
 *
 * Declared one by one rather than generated from a list: `addChildren` needs
 * the literal tuple to infer the route tree, and that inference is what makes
 * `navigate({ to: "/orders/$orderId/review", params: { orderId } })` a compile
 * error when the path or the param name is wrong. A loop costs fewer lines and
 * throws that away.
 *
 * THERE IS NO ROUTE-LEVEL ROLE GUARD, deliberately. A role's world is enforced
 * two ways: the door is ABSENT from the rail and the map, and the chord refuses
 * to open it. Both read the same `canAccess` table the server gates with, and
 * the server refuses the data regardless — which is the layer that matters.
 * The four harvested world-boundary tests (`roles.spec`) ARE NOT BUILT as a
 * spec file; `authz.test.ts` proves the table and `sidebar.spec` #2 the rail.
 */
export const rootRoute = createRootRoute({
  component: () => (
    <>
      <GlobalKeys />
      {/*
        THE RAIL SITS BESIDE THE CONTENT, not above it (§11). AppChrome renders
        the left sidebar, or nothing on the capture seat — where a null sibling
        just leaves the content column as the sole flex child at full width,
        which is the structural-blindness rule made layout.

        THE CONTENT SIDE IS A COLUMN, not just `main`: `OrderStrip` — the
        full-width order-context bar (§11 2026-07-30 revision) — sits above
        `main` inside its own flex column, beside the sidebar rather than a
        third row-level sibling. `OrderStrip` is absent on the capture seat the
        same way `AppChrome` is, both reading `/blind/*` from the URL
        independently rather than one gating the other.

        THE PAGE DOES NOT SCROLL — the export roots at `height:100vh;
        overflow:hidden` and gives each screen body its own `height:100%;
        overflow:auto`, so every region scrolls inside its own box. Page-scrolling
        instead is what rendered Review 3,276px tall against the export's single
        1,000px frame, left the sidebar terminating over blank ground, and
        scrolled the order counts away from the order they count.

        THE SHELL IMPOSES NO MEASURE AND NO PADDING. It used to do both, badly:
        one 1,440px cap (`max-w-720` on a 2px base) and `p-9` — 18px against the
        export's 28–40px. Worse, `mx-auto` on a `flex-1` flex item CANCELS
        `align-self:stretch`, so `main` sized shrink-to-fit and every screen came
        out narrower than drawn: Queue asked for 860px and got 670px, Profile
        collapsed to its content's 421px where the export draws 720px. No
        viewport-width guard catches that — the binding constraint is the
        container. Measure, padding and placement now belong to `Screen`, which
        each screen picks from the export's own table.
      */}
      <div className="flex h-screen overflow-hidden">
        <AppChrome />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <OrderStrip />
          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  ),
  notFoundComponent: NotFound,
});
