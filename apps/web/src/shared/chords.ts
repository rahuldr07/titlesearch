/**
 * The chord layer. Every global single-key shortcut goes through here.
 * A tagName guard (INPUT/TEXTAREA/SELECT) cannot see react-aria composites —
 * a Menu or ComboBox listbox is a `<div role="listbox">` with typeahead, so a
 * printable chord would both fire a screen action and jump the menu. The
 * contract: a global chord is suspended, never cancelled, while a text
 * surface or an overlay owns focus, and it resumes on close without a click.
 * Suspension is by scope, not by tag. Chords are not installed at all until
 * signed in. `tinykeys` rather than `react-hotkeys-hook` because the latter
 * does not recognise `?` or `[` as hotkey names.
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
 * Is a modal layer up? Asked of the DOM rather than of a store: the DOM is
 * the layer that actually decides who receives the keystroke, and a store
 * copy drifts exactly during the transition. The `data-chord-scope` check
 * covers the one-frame gap between "open" and "focused" — one frame is
 * enough for a held key to repeat.
 */
export function overlayIsUp(doc: Document): boolean {
  return (
    doc.querySelector("[role='dialog'],[role='alertdialog']") !== null ||
    doc.querySelector("[data-chord-scope='own']") !== null
  );
}

export type ChordBindings = Readonly<Record<string, (event: KeyboardEvent) => void>>;

export type UseChordsOptions = {
  /** Chords are not installed at all while false — dead until signed in. */
  readonly enabled: boolean;
  /**
   * Bindings that survive an open overlay — the palette's own dismiss, for
   * instance. Default none: opting a key out of suppression should be a
   * deliberate, visible act at the call site.
   */
  readonly alwaysOn?: ChordBindings;
};

/**
 * Install global chords for the lifetime of the calling component.
 * The suspension test runs inside the handler on every keystroke, not by
 * binding and unbinding as focus moves — that is why chords resume without a
 * click: nothing was unbound, the handler simply declined to act.
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
 * Why this keystroke is standing down, or null if it is not. Returned rather
 * than thrown away so a caller can log it — a chord that silently does
 * nothing is indistinguishable from a broken one.
 */
export function suspendedBecause(event: KeyboardEvent): SuspendReason | null {
  const target = event.target;
  const active = target instanceof Element ? target : document.activeElement;

  if (focusOwnsKeys(active)) return "text-entry";
  if (overlayIsUp(document)) return "overlay";
  return null;
}
