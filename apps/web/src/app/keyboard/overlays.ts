import { create } from "zustand";

/**
 * WHICH OVERLAY IS UP — a STACK, not a set of booleans.
 *
 * `ANALYSIS-behavior.md` §3 is explicit about why: "Escape is never suppressed
 * and pops EXACTLY ONE layer, innermost first… The prototype's single flat
 * `setState` that clears all of them at once is wrong for a layered UI and must
 * not be reproduced." A record of booleans cannot answer "which is innermost",
 * so it is a stack and Escape pops one.
 *
 * This store does NOT decide whether chords are suppressed. `shared/chords.ts`
 * asks the DOM (`overlayIsUp`), deliberately — its own header records the
 * reasoning: "a store copy of 'is a dialog open' is a second source of truth
 * that drifts from the first exactly when it matters — during the transition."
 * This store answers a different question: what should be RENDERED. The two
 * agree because the render is what puts `role="dialog"` in the DOM.
 *
 * `key-map` is the `?` shortcut list; `na-guide` and `order-history` are the
 * two other cross-cutting overlays. All four are transient dialogs, so all four
 * stand the chord layer down while they are up, and Escape pops exactly one.
 */
export type Overlay = "palette" | "key-map" | "na-guide" | "order-history";

interface OverlayState {
  stack: readonly Overlay[];
  open: (overlay: Overlay) => void;
  close: (overlay: Overlay) => void;
  toggle: (overlay: Overlay) => void;
  /** Pop exactly one layer, innermost first. Returns whether anything popped. */
  popOne: () => boolean;
}

export const useOverlays = create<OverlayState>((set, getState) => ({
  stack: [],
  open: (overlay) =>
    set((s) =>
      s.stack.includes(overlay) ? s : { stack: [...s.stack, overlay] },
    ),
  close: (overlay) => set((s) => ({ stack: s.stack.filter((o) => o !== overlay) })),
  toggle: (overlay) =>
    set((s) =>
      s.stack.includes(overlay)
        ? { stack: s.stack.filter((o) => o !== overlay) }
        : { stack: [...s.stack, overlay] },
    ),
  popOne: () => {
    const { stack } = getState();
    if (stack.length === 0) return false;
    set({ stack: stack.slice(0, -1) });
    return true;
  },
}));

/** Is this overlay currently rendered? */
export function useOverlayOpen(overlay: Overlay): boolean {
  return useOverlays((s) => s.stack.includes(overlay));
}
