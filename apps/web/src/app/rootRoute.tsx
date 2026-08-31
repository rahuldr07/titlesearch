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
 * The frame. One viewport tall, and it never scrolls: `styles.css` roots
 * `html/body/#root` at `height:100%; overflow:hidden`, this lays a
 * two-column flex box inside that, and every pane below owns its own
 * scroller — nothing here is `min-h-screen`. The order strip sits above
 * `main` inside the content column, which keeps it still while the screen
 * scrolls under it. `main` carries no `mx-auto`: auto inline margins on a
 * flex item cancel `align-self:stretch`, so a centred `flex-1 main` sizes
 * shrink-to-fit and every screen comes out narrower than drawn.
 *
 * The sign-in gate is structural, not a redirect: with no session this
 * renders the sign-in screen instead of the frame, so the rail and strip are
 * simply not mounted. A redirect would lose the URL the reader asked for;
 * leaving it alone means signing in lands you where you were going.
 *
 * The palette and the three cross-cutting overlays are mounted here, once —
 * they are portalled, so their position governs lifetime, not placement, and
 * an overlay per screen would unmount mid-transition and lose focus return.
 * All four are dialogs, so all four stand the chord layer down while up and
 * Escape pops exactly one.
 */
function RootFrame() {
  const signedIn = useSignedIn((s) => s.account !== null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // The permission payload gates every door. Not fetched at all while signed
  // out — asking "what may I do" with no session is a question with no subject.
  const permissions = usePermissions(signedIn);
  /** Asked once — the rail and the palette must agree. */
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
         * The capture seat has no rail: the rail names worlds a blind typist
         * must not see. Read off the URL, not the role — an admin standing at
         * the seat is still at the seat.
         */}
        {!seat && <SideRail rules={permissions.data?.rules} />}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-app">
          <OrderStrip />
          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            {/*
             * Keyed on the pathname: a new boundary per screen, so a screen
             * that threw does not latch across a navigation and the chrome
             * around it keeps rendering.
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
       * Not mounted at the seat — the palette is the other navigator, and it
       * must gate on the same path test as the rail or Ctrl+K at the seat
       * lists every door.
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
