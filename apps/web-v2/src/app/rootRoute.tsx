import { createRootRoute, Outlet } from "@tanstack/react-router";
import { GlobalKeys } from "./GlobalKeys";
import { AppChrome } from "./AppChrome";
import { OrderStrip } from "./OrderStrip";
import { NotFound } from "./Placeholders";

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
 * two ways the harvested specs actually assert: the door is ABSENT from the hub
 * and the map, and the chord refuses to open it (`roles.spec` ×4). Both read
 * the same `canAccess` table the server gates with, and the server refuses the
 * data regardless — which is the layer that matters.
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

        THE SHELL DOES NOT IMPOSE A READING COLUMN. It was capped at 800px —
        `max-w-400` against a 2px spacing base — which starved every wide screen
        in the app regardless of window size. Overview's seven-stage board
        overflowed that cap by 426px and hid two whole stages behind a scroll
        with no affordance. A screen that wants a narrow measure sets its own;
        the shell's job is the gutter and the maximum, and the maximum belongs
        to the widest screen rather than the narrowest.
      */}
      <div className="flex min-h-screen">
        <AppChrome />
        <div className="flex min-w-0 flex-1 flex-col">
          <OrderStrip />
          <main className="mx-auto min-w-0 max-w-720 flex-1 p-9">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  ),
  notFoundComponent: NotFound,
});
