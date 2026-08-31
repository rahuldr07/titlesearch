import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./rootRoute";
import { Unbuilt } from "./chrome/Unbuilt";
import { UNBUILT_SCREENS, type ScreenDescriptor } from "./chrome/unbuiltScreens";
import { BUILT_SCREENS } from "./chrome/builtScreens";

/**
 * The flat doors, as a loop — a door with no params and no search key cannot
 * have a wrong one, so the types buy nothing here; the hand-written routes
 * stay in `routeTree.tsx`/`orderRoutes.tsx`. Every `path` comes from the
 * frozen authz table via `UNBUILT_SCREENS`; nothing here invents one.
 * An unbuilt door renders `Unbuilt`, which names the screen, its contract
 * surface, and what is missing — deliberately not a transcription of the
 * design prototype's markup, which is full of values that cannot be cited.
 * A convincing mock reads as finished, which is worse than an honest gap.
 */

/** Named once because the loop below excludes it. */
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
