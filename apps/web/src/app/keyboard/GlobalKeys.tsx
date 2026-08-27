import { useMemo } from "react";
import { useChords } from "../../shared/chords";
import { useOverlays } from "./overlays";
import { useSignedIn } from "../session/signedIn";

/**
 * THE GLOBAL CHORD LAYER, INSTALLED ONCE.
 *
 * Four keys and no fifth, per design README §Interactions: ⌘K palette,
 * ? shortcuts, / focuses search, Esc closes. C/E/Q/J/K/Z belong to the review
 * screen and are installed by that screen, not here — INVARIANT 50 makes keys
 * pane-local, "the innermost layer that can use a key wins."
 *
 * ══ DEAD UNTIL SIGNED IN, AND "DEAD" IS LITERAL ════════════════════════════
 *
 * `useChords({ enabled })` does not install the listener at all while false
 * (`shared/chords.ts`: "Chords are DEAD until signed in. Not merely inert: not
 * installed."). `chord-suppression.spec` #6 presses all eight keys on the
 * sign-in screen and requires the URL not to move and no overlay to appear.
 *
 * ══ WHY ESCAPE IS `alwaysOn` AND EVERYTHING ELSE IS NOT ════════════════════
 *
 * `useChords` runs the suppression test on every ordinary binding, so ⌘K, ?
 * and / all stand down while an overlay is up or a text surface holds focus.
 * That is what makes `chord-suppression.spec` #5 pass: with the palette open,
 * typing "?/" lands in the palette input as text and the key map never
 * appears.
 *
 * Escape must fire from INSIDE those same places — it is how you leave them —
 * so it is the one binding opted out of suppression, deliberately and visibly,
 * which is exactly what `alwaysOn` is for. It pops ONE layer, innermost first
 * (ANALYSIS-behavior §3), and returns without preventing default when there is
 * nothing to pop, so a react-aria popover keeps its own dismissal.
 */
export function GlobalKeys() {
  const signedIn = useSignedIn((s) => s.account !== null);
  const toggle = useOverlays((s) => s.toggle);
  const popOne = useOverlays((s) => s.popOne);

  const bindings = useMemo(
    () => ({
      "$mod+k": (event: KeyboardEvent) => {
        event.preventDefault();
        toggle("palette");
      },
      "?": (event: KeyboardEvent) => {
        event.preventDefault();
        toggle("key-map");
      },
      "/": (event: KeyboardEvent) => {
        /*
         * The design says `/` "focuses search". THERE IS NO SEARCH TO FOCUS,
         * and this is a contract refusal rather than an unbuilt screen: the
         * design's search belongs to screen 3 (All Orders), which
         * ANALYSIS-screens §6 records as a HARD CONFLICT — `INVARIANTS:82-83`
         * forbids a browsable order list, and `endpoints.ts:69` states there is
         * no browse/pick endpoint.
         *
         * So `/` opens the command palette, which is the one search surface
         * that exists and does not browse orders. It is NOT silently dropped:
         * a dead key is indistinguishable from a broken one.
         */
        event.preventDefault();
        toggle("palette");
      },
    }),
    [toggle],
  );

  const alwaysOn = useMemo(
    () => ({
      Escape: (event: KeyboardEvent) => {
        if (popOne()) event.preventDefault();
      },
    }),
    [popOne],
  );

  useChords(bindings, { enabled: signedIn, alwaysOn });

  return null;
}
