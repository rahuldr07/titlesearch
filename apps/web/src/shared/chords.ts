/**
 * The chord layer.
 * Every global single-key shortcut in this app goes through here, and the
 * reason is a bug the reference prototype ships.
 * WHAT THE PROTOTYPE DOES (design_handoff_titlepipe/reference-app.html): one
 * `window.addEventListener("keydown")`, guarded by a tagName test —
 * INPUT / TEXTAREA / SELECT / isContentEditable. That guard is structurally
 * incapable of seeing a `react-aria-components` Menu, Select, ComboBox or
 * GridList, whose listboxes are `<div role="listbox">`. They are not INPUT,
 * they DO implement typeahead, and `c` `e` `q` `j` `k` `z` `/` are all
 * printable. So `q` would both escalate the open field AND jump a menu to
 * "Quarantine".
 * Worse: the prototype never guards on its own help overlay. Press `?` then
 * `c` and you CONFIRM A RULING from inside the cheat sheet — on a field
 * carrying T1 exposure. `apps/web-v2/e2e/invariants/chord-suppression.spec.ts`
 * pins both.
 * WHAT PINS WHAT, stated because REVIEW-01 found this header citing a test as
 * proof of a claim the code did not implement:
 *   - `src/shared/focusOwnership.test.ts` — DOM-free, runs in the `gates`
 *     Vitest project, pins every role in both tables including the nine the
 *     review proved missing. This is the check that runs on every `pnpm test`.
 *   - `e2e/invariants/chord-suppression.spec.ts` — the same rules against a
 *     real screen. It is a Playwright spec and it needs the review screen,
 *     which is still a Placeholder in `app/routeTree.tsx`, so it cannot pass
 *     yet. It is not skipped and it is not deleted: it fails honestly until
 *     the screen lands, which is what BRIEF §5 Phase 5 asks for.
 * THE CONTRACT THIS IMPLEMENTS, in one sentence: a global chord is SUSPENDED,
 * never cancelled, while a text surface or an overlay holds focus, and it
 * RESUMES on close without a click.
 * Three consequences worth stating, because each is a test:
 *   - Suspension is by SCOPE, not by tag. The innermost layer that can use a
 *     key wins. `activeElement` is asked what it is, not what element it is.
 *   - Resumption needs no click. Closing an overlay restores chords on the very
 *     next keystroke, because nothing was unbound — the handler stayed
 *     installed and simply declined to act.
 *   - Chords are DEAD until signed in (design README §Interactions). Not
 *     merely inert: not installed.
 * `tinykeys` rather than `react-hotkeys-hook`: HANDOFF-UI.md:167 records that
 * the latter "does not recognise `?` or `[` as hotkey names. Both were
 * registered and never fired."
 */

import { useEffect } from "react";
import { tinykeys } from "tinykeys";
import { focusOwnsKeys } from "./focusOwnership";

export { focusOwnsKeys };

/**
 * Why a chord is standing down. Not a boolean, because the three reasons want
 * different handling and a boolean would let a caller conflate them.
 */
export type SuspendReason = "text-entry" | "overlay" | "signed-out";

/**
 * Is a modal layer up?
 * Asked of the DOM rather than of a store, deliberately. React Aria portals
 * its overlays and marks the rest of the page `aria-hidden`; a store copy of
 * "is a dialog open" is a second source of truth that drifts from the first
 * exactly when it matters — during the transition. The DOM is the layer that
 * actually decides who receives the keystroke, so it is the layer that is
 * asked.
 * `[data-chord-scope='own']` appears here as well as above so an overlay that
 * is up but has not yet moved focus still stands the global layer down. The
 * gap between "open" and "focused" is one frame, and one frame is enough for a
 * held key to repeat.
 */
export function overlayIsUp(doc: Document): boolean {
  return (
    doc.querySelector("[role='dialog'],[role='alertdialog']") !== null ||
    doc.querySelector("[data-chord-scope='own']") !== null
  );
}

export type ChordBindings = Readonly<Record<string, (event: KeyboardEvent) => void>>;

export type UseChordsOptions = {
  /** Chords are not installed at all while false. Design: "dead until signed in." */
  readonly enabled: boolean;
  /**
   * Bindings that survive an open overlay — the palette's own dismiss, for
   * instance. Default none: opting a key OUT of suppression should be a
   * deliberate, visible act at the call site.
   */
  readonly alwaysOn?: ChordBindings;
};

/**
 * Install global chords for the lifetime of the calling component.
 * The suspension test runs INSIDE the handler, on every keystroke, rather than
 * by binding and unbinding as focus moves. That is the mechanism behind
 * "resumes without a click": there is nothing to re-bind, so there is no
 * window in which a chord is lost, and no ordering bug between a close
 * animation and a rebind.
 */
export function useChords(bindings: ChordBindings, options: UseChordsOptions): void {
  const { enabled, alwaysOn } = options;

  useEffect(() => {
    if (!enabled) return;

    const guarded: Record<string, (event: KeyboardEvent) => void> = {};

    for (const [key, run] of Object.entries(bindings)) {
      guarded[key] = (event: KeyboardEvent) => {
        if (suspendedBecause(event) !== null) return;
        run(event);
      };
    }

    for (const [key, run] of Object.entries(alwaysOn ?? {})) {
      guarded[key] = run;
    }

    return tinykeys(window, guarded);
  }, [bindings, alwaysOn, enabled]);
}

/**
 * Why this keystroke is standing down, or null if it is not.
 * Returned rather than thrown away so a caller can log it. A chord that
 * silently does nothing is indistinguishable from a chord that is broken, and
 * this project has already shipped one of those.
 */
export function suspendedBecause(event: KeyboardEvent): SuspendReason | null {
  const target = event.target;
  const active = target instanceof Element ? target : document.activeElement;

  if (focusOwnsKeys(active)) return "text-entry";
  if (overlayIsUp(document)) return "overlay";
  return null;
}
