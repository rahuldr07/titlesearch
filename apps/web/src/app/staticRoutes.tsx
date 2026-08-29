import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./rootRoute";
import { Unbuilt } from "./chrome/Unbuilt";
import { UNBUILT_SCREENS, type ScreenDescriptor } from "./chrome/unbuiltScreens";
import { BUILT_SCREENS } from "./chrome/builtScreens";

/**
 * THE FIFTEEN FLAT DOORS, AS A LOOP. Split out of `routeTree.tsx` on the
 * 150-line gate, and the seam is the one that file already argues for: this is
 * where the types buy nothing — a door with no params and no search key cannot
 * have a wrong one — while `routeTree.tsx` keeps the routes that are
 * hand-written precisely because their params and search keys DO buy a
 * compile-time guarantee.
 *
 * Every `path` is copied from `authz.ts:62-81` via `UNBUILT_SCREENS`. Nothing
 * here invents one: a screen at a path not in that table is unreachable by
 * design.
 *
 * `Unbuilt` names what the screen is, which contract surface it binds to, and
 * what is missing. It is deliberately NOT a transcription of the design
 * prototype's markup: that markup is full of values — order refs, counts,
 * addresses, a "128 cited" headline — and root AGENTS.md forbids emitting a
 * value that cannot be cited. A convincing mock reads as finished to everybody
 * who opens it, which is worse than an honest gap.
 */

/** `authz.ts:81`'s path, named once because the loop below excludes it. */
export const ACCOUNT_PATH = "/account";

const parent = () => rootRoute;

export const staticRoutes = UNBUILT_SCREENS.filter(
  (descriptor) => descriptor.path !== ACCOUNT_PATH,
).map((descriptor) => {
  const Built = BUILT_SCREENS[descriptor.path];
  return createRoute({
    getParentRoute: parent,
    path: descriptor.path,
    component:
      Built === undefined ? () => <Placeholder descriptor={descriptor} /> : Built,
  });
});

/** The honest gap a door renders when its screen is not built. */
export function Placeholder(props: { readonly descriptor: ScreenDescriptor }) {
  return (
    <Unbuilt
      screen={props.descriptor.screen}
      door={props.descriptor.path}
      binds={props.descriptor.binds}
      missing={props.descriptor.missing}
    />
  );
}
