import { createRootRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { Toaster } from "../shared/notify";
import { useSignedIn } from "./session/signedIn";
import { usePermissions } from "./session/permissions";
import { SideRail } from "./chrome/SideRail";
import { OrderStrip } from "./chrome/OrderStrip";
import { ScreenBoundary } from "./chrome/ScreenBoundary";
import { NotFound } from "./chrome/Unbuilt";
import { GlobalKeys } from "./keyboard/GlobalKeys";
import { CommandPalette } from "./keyboard/CommandPalette";
import { ShortcutsOverlay } from "../features/overlays/ShortcutsOverlay";
import { NaGuideOverlay } from "../features/overlays/NaGuideOverlay";
import { OrderHistoryOverlay } from "../features/overlays/OrderHistoryOverlay";
import { isCaptureSeat } from "./chrome/captureSeat";
import { SigninScreen } from "../features/signin/SigninScreen";

/**
 * THE FRAME. One viewport tall, and it never scrolls (INVARIANT 60).
 *
 * `styles.css` roots `html/body/#root` at `height:100%; overflow:hidden`; this
 * lays a two-column flex box inside that, and every pane below owns its own
 * scroller. Nothing here is `min-h-screen` — that is what rendered Review
 * 3,276px tall against the design's single 1,000px frame and left the rail
 * terminating over blank ground.
 *
 * The rail is the first flex child at full height (INVARIANT 63: a full-height
 * COLUMN, not a page-sticky element). The content side is a COLUMN, not just
 * `main`: the order strip sits above `main` INSIDE it, which is what keeps the
 * strip still while the screen scrolls under it (INVARIANT 62).
 *
 * `main` carries no `mx-auto` and no measure. Auto inline margins on a flex
 * item CANCEL `align-self:stretch`, so a centred `flex-1 main` sizes
 * shrink-to-fit and every screen comes out narrower than drawn — the defect
 * `shell-frame.spec` #2 exists for, which no viewport-width guard catches
 * because the binding constraint is the container.
 *
 * ══ THE SIGN-IN GATE IS STRUCTURAL, NOT A REDIRECT ═════════════════════════
 *
 * INVARIANT 45: "Nobody signed in is shown an ADMIN world." With no session
 * this renders the sign-in screen INSTEAD OF the frame — the rail and the strip
 * are not mounted, so `shell-frame.spec`'s `toHaveCount(0)` holds by
 * construction rather than by each screen remembering to be bare.
 *
 * A `beforeLoad` redirect to `/sign-in` was the alternative and is worse: it
 * loses the URL the reader asked for, it fires before the router has a location
 * to return to, and it makes "am I signed in" a routing concern in an app where
 * it is a rendering one. The URL is left alone, so signing in lands you where
 * you were going.
 *
 * ══ THE OVERLAYS ARE MOUNTED HERE, ONCE ════════════════════════════════════
 *
 * The palette and the three cross-cutting overlays — the shortcut list, the
 * no-value guide and the order history — are portalled by react-aria, so their
 * position in this tree governs their LIFETIME, not their placement. Mounted
 * once at the root: an overlay per screen would unmount mid-transition and lose
 * focus return, which `key-map-modal.spec` #4 pins.
 *
 * All four are dialogs, so all four stand the chord layer down while up
 * (INVARIANT 46 territory) and Escape pops exactly one — the palette and an
 * overlay never both own focus.
 */
function RootFrame() {
  const signedIn = useSignedIn((s) => s.account !== null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // The permission payload gates every door. Not fetched at all while signed
  // out — asking "what may I do" with no session is a question with no subject.
  const permissions = usePermissions(signedIn);
  /** INVARIANT 46, asked once — the rail and the palette must agree. */
  const seat = isCaptureSeat(pathname);

  if (!signedIn) {
    return (
      <>
        <SigninScreen />
        <Toaster hotkey={["altKey", "KeyY"]} />
      </>
    );
  }

  return (
    <>
      <GlobalKeys />
      <div className="flex h-full overflow-hidden">
        {/*
         * INVARIANT 46 — THE CAPTURE SEAT HAS NO RAIL. Structural blindness
         * includes the navigator: the rail names worlds (Review, Escalations,
         * Golden set) a typist must not see, and seeing which stage an order
         * has reached is itself information the blind protocol withholds.
         *
         * Read off the URL rather than off the role, deliberately. An admin
         * standing at the seat is still at the seat, and gating on role would
         * draw the full rail for exactly the person most likely to be
         * demonstrating the protocol.
         */}
        {!seat && <SideRail rules={permissions.data?.rules} />}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-app">
          <OrderStrip />
          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            {/*
             * The boundary is keyed on the pathname, so it is a NEW boundary
             * per screen and a screen that threw does not latch across a
             * navigation. INVARIANT 59: the failure stays in this region and
             * the chrome above and beside it keeps rendering.
             */}
            <ScreenBoundary resetKey={pathname}>
              <Outlet />
            </ScreenBoundary>
          </main>
        </div>
      </div>
      <ShortcutsOverlay />
      <NaGuideOverlay />
      <OrderHistoryOverlay />
      {/*
       * NOT MOUNTED AT THE SEAT. The palette is the other navigator, and it was
       * gated on role while the rail was gated on path — so Ctrl+K at the seat
       * listed every door including Review. See `chrome/captureSeat.ts`, which
       * carries the measurement.
       */}
      {!seat && <CommandPalette rules={permissions.data?.rules} />}
      <Toaster hotkey={["altKey", "KeyY"]} />
    </>
  );
}

export const rootRoute = createRootRoute({
  component: RootFrame,
  notFoundComponent: NotFound,
});
