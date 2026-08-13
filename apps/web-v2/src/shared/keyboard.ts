import { useHotkeys } from "react-hotkeys-hook";
import { create } from "zustand";

/**
 * Whether the GLOBAL key layer currently owns the keyboard.
 *
 * Two situations, one consequence. An ARMED chord must consume its second key
 * so `g` then `e` navigates instead of also opening the escalate editor
 * (`navigation.spec` #2), and the OPEN key map is modal — `c` must not open an
 * editor underneath it and `j` must not move the selection (`navigation.spec`
 * #3). Both are the same rule: a key belongs to exactly one layer at a time.
 *
 * This lives outside React state because the screen that must stand down is
 * not a child of the layer that stands up, and threading a prop through the
 * router to every screen would make the coupling worse rather than smaller.
 *
 * Ephemeral by construction — no persistence, nothing in browser storage
 * (§9.11). A keyboard mode that survived a reload would be a mode nobody could
 * see and nobody could clear.
 */
interface KeyboardLayer {
  armed: boolean;
  mapOpen: boolean;
  setArmed: (armed: boolean) => void;
  setMapOpen: (mapOpen: boolean) => void;
}

export const useKeyboardLayer = create<KeyboardLayer>((set) => ({
  armed: false,
  mapOpen: false,
  setArmed: (armed) => set({ armed }),
  setMapOpen: (mapOpen) => set({ mapOpen }),
}));

/** True while a screen's own hotkeys must stand down. */
export function useGlobalKeysHold(): boolean {
  return useKeyboardLayer((s) => s.armed || s.mapOpen);
}

/**
 * THE SAME RULE, ONE LAYER FURTHER IN: a FOCUSED CONTROL owns its keystroke.
 *
 * A link activates on Enter, a button on Enter and Space; while one holds focus
 * the screen's shortcut for that key must neither fire nor suppress the
 * default. `queue-keys.spec` states the failure: the queue bound Enter to the
 * document with `preventDefault: true`, so no rail door could be followed from
 * the keyboard and every attempt ASSIGNED THE READER AN ORDER instead.
 *
 * Text fields are listed for completeness only — react-hotkeys-hook already
 * refuses to fire inside form tags (`hard.spec` #5, `sidebar.spec` #5).
 */
const INTERACTIVE =
  "a[href], button, input, textarea, select, summary, [contenteditable='true']," +
  " [role='button'], [role='link'], [role='tab'], [role='menuitem'], [role='option']," +
  " [tabindex]:not([tabindex='-1'])";

/* Module-private: a second caller deciding this for itself is how the queue
 * came to bind Enter to the document. Everything goes through the binder. */
function focusOwnsTheKey(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE) !== null;
}

/**
 * A screen-level key, bound with BOTH guards and with the library's
 * `preventDefault` option deliberately unused.
 *
 * That option cannot express "prevent the default when I act":
 * react-hotkeys-hook evaluates it BEFORE a FUNCTION `enabled`
 * (`maybePreventDefault(…), !isHotkeyEnabled(…)` in one expression), so a
 * predicate returning false still swallows the keystroke. Only a literal
 * `false` short-circuits — that path never attaches a listener. Hence boolean
 * `enabled` for the hold, and a hand-called `preventDefault` where we act.
 */
export function useScreenHotkey(
  keys: string,
  act: () => void,
  deps: readonly unknown[],
): void {
  const held = useGlobalKeysHold();
  useHotkeys(
    keys,
    (event) => {
      if (focusOwnsTheKey(event.target)) return;
      event.preventDefault();
      act();
    },
    { enabled: !held },
    [held, ...deps],
  );
}
