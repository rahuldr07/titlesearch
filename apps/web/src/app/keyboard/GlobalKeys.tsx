import { useMemo } from "react";
import { useChords, type ChordBindings } from "../../shared/chords";
import { useOverlays } from "./overlays";
import { useSignedIn } from "../session/signedIn";
import { KEYMAP, type ChordAction } from "./keymap";

/**
 * THE GLOBAL CHORD LAYER, INSTALLED ONCE — FROM `keymap.ts`.
 *
 * The patterns are no longer written here. `keymap.ts` is the registry and this
 * file supplies the HANDLERS; the two are joined by `action`, so the shortcuts
 * overlay cannot advertise a key this file does not install and this file
 * cannot install one the overlay does not list. Rule 11 across two files.
 *
 * C/E/Q/J/K/Z belong to the review screen and are installed by that screen, not
 * here — INVARIANT 50 makes keys pane-local, "the innermost layer that can use
 * a key wins." No screen installs them yet, which is why they are absent from
 * the registry rather than listed as bindings that do not fire.
 *
 * ══ DEAD UNTIL SIGNED IN, AND "DEAD" IS LITERAL ════════════════════════════
 *
 * `useChords({ enabled })` does not install the listener at all while false
 * (`shared/chords.ts`). `chord-suppression.spec` #6 presses all eight keys on
 * the sign-in screen and requires the URL not to move and no overlay to appear.
 *
 * ══ WHY ESCAPE IS `alwaysOn` AND EVERYTHING ELSE IS NOT ════════════════════
 *
 * `useChords` runs the suppression test on every ordinary binding, so ⌘K, ?
 * and / all stand down while an overlay is up or a text surface holds focus.
 * That is what makes `chord-suppression.spec` #5 pass: with the palette open,
 * typing "?/" lands in the palette input as text and the key map never appears.
 *
 * Escape must fire from INSIDE those same places — it is how you leave them —
 * so it is the one binding opted out of suppression, and the registry says so
 * per row rather than this file remembering. It pops ONE layer, innermost first
 * (ANALYSIS-behavior §3), and returns without preventing default when there is
 * nothing to pop, so a react-aria popover keeps its own dismissal.
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
    const target = spec.alwaysOn ? alwaysOn : bindings;
    target[spec.chord] = handlers[spec.action];
  }
  return { bindings, alwaysOn };
}
