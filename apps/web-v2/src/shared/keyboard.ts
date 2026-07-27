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
