import { useMemo } from "react";
import { useChords, type ChordBindings } from "../../shared/chords";
import { useOverlays } from "./overlays";
import { useSignedIn } from "../session/signedIn";
import { KEYMAP, type ChordAction } from "./keymap";

/**
 * The global chord layer, installed once — from `keymap.ts`. The registry
 * holds the patterns and this file supplies the handlers, joined by
 * `action`, so the shortcuts overlay cannot advertise a key this file does
 * not install and this file cannot install one the overlay does not list.
 * The review keys are in the registry but installed by the review screen —
 * `install()` below skips every row this file is not the installer of.
 * Chords are dead, not merely inert, until signed in: `useChords` does not
 * install the listener at all. Escape is the one binding opted out of
 * suppression — it must fire from inside an overlay or a text surface, since
 * it is how you leave them — and it returns without preventing default when
 * there is nothing to pop, so a react-aria popover keeps its own dismissal.
 */
export function GlobalKeys() {
  const signedIn = useSignedIn((s) => s.account !== null);
  const toggle = useOverlays((s) => s.toggle);
  const popOne = useOverlays((s) => s.popOne);

  const handlers = useMemo<Record<ChordAction, (event: KeyboardEvent) => void>>(
    () => ({
      "open-palette": (event) => {
        event.preventDefault();
        toggle("palette");
      },
      "toggle-key-map": (event) => {
        event.preventDefault();
        toggle("key-map");
      },
      "pop-layer": (event) => {
        if (popOne()) event.preventDefault();
      },
    }),
    [toggle, popOne],
  );

  const { bindings, alwaysOn } = useMemo(() => install(handlers), [handlers]);

  useChords(bindings, { enabled: signedIn, alwaysOn });

  return null;
}

/** Split the registry into the suppressed layer and the one key above it. */
function install(handlers: Record<ChordAction, (event: KeyboardEvent) => void>): {
  bindings: ChordBindings;
  alwaysOn: ChordBindings;
} {
  const bindings: Record<string, (event: KeyboardEvent) => void> = {};
  const alwaysOn: Record<string, (event: KeyboardEvent) => void> = {};
  for (const spec of KEYMAP) {
    // A `review` row is the workstation's; its `action` is null by definition.
    if (spec.install !== "global" || spec.action === null) continue;
    const target = spec.alwaysOn ? alwaysOn : bindings;
    target[spec.chord] = handlers[spec.action];
  }
  return { bindings, alwaysOn };
}
