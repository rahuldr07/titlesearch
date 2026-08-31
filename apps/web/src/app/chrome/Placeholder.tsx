import { Unbuilt } from "./Unbuilt";
import type { ScreenDescriptor } from "./unbuiltScreens";

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
