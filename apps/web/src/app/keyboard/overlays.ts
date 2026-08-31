import { create } from "zustand";

/**
 * Which overlay is up — a stack, not a set of booleans: Escape is never
 * suppressed and pops exactly one layer, innermost first, and a record of
 * booleans cannot answer "which is innermost". This store does not decide
 * whether chords are suppressed — `shared/chords.ts` asks the DOM for that;
 * this store answers what should be rendered, and the two agree because the
 * render is what puts `role="dialog"` in the DOM.
 *
 * `order-history` needs a subject. `/orders/:id` in the URL serves the
 * order-scoped screens but not a table row, so `openOrderHistory(id)` names
 * one and the overlay falls back to the route when nobody did. The name is
 * cleared on close, so a later route-scoped open can never inherit the last
 * table row's order.
 */
export type Overlay = "palette" | "key-map" | "na-guide" | "order-history";

interface OverlayState {
  stack: readonly Overlay[];
  /** The order the history overlay is about, when a caller named one. */
  historySubject: string | null;
  open: (overlay: Overlay) => void;
  close: (overlay: Overlay) => void;
  toggle: (overlay: Overlay) => void;
  /** Open the history overlay on a named order, from anywhere. */
  openOrderHistory: (orderId: string) => void;
  /** Pop exactly one layer, innermost first. Returns whether anything popped. */
  popOne: () => boolean;
}

/** Closing the history overlay forgets its subject — never inherited. */
function forget(overlay: Overlay): { historySubject: null } | Record<string, never> {
  return overlay === "order-history" ? { historySubject: null } : {};
}

export const useOverlays = create<OverlayState>((set, getState) => ({
  stack: [],
  historySubject: null,
  openOrderHistory: (orderId) =>
    set((s) => ({
      historySubject: orderId,
      stack: s.stack.includes("order-history")
        ? s.stack
        : [...s.stack, "order-history"],
    })),
  open: (overlay) =>
    set((s) =>
      s.stack.includes(overlay) ? s : { stack: [...s.stack, overlay] },
    ),
  close: (overlay) =>
    set((s) => ({ stack: s.stack.filter((o) => o !== overlay), ...forget(overlay) })),
  toggle: (overlay) =>
    set((s) =>
      s.stack.includes(overlay)
        ? { stack: s.stack.filter((o) => o !== overlay), ...forget(overlay) }
        : { stack: [...s.stack, overlay] },
    ),
  popOne: () => {
    const { stack } = getState();
    const top = stack.at(-1);
    if (top === undefined) return false;
    set({ stack: stack.slice(0, -1), ...forget(top) });
    return true;
  },
}));

/** Is this overlay currently rendered? */
export function useOverlayOpen(overlay: Overlay): boolean {
  return useOverlays((s) => s.stack.includes(overlay));
}
