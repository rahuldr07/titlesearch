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
 *
 * ══ ONE OVERLAY, TWO WAYS OF BEING TOLD WHICH ORDER ════════════════════════
 *
 * `order-history` needs a SUBJECT, and it had exactly one way of learning it:
 * `/orders/:id` in the URL. That is fine from an order-scoped screen and
 * useless from All Orders, whose design draws a history button on every row —
 * a table of twenty orders is not on any one order's route. A second overlay
 * would have been two copies of one surface, so the subject moved here instead:
 * `openOrderHistory(id)` names it, and the overlay falls back to the route when
 * nobody did. The name is cleared on close, so a later route-scoped open can
 * never inherit the last table row's order.
 */
export type Overlay = "palette" | "key-map" | "na-guide" | "order-history";

interface OverlayState {
  stack: readonly Overlay[];
  /** The order the history overlay is about, when a caller named one. */
  historySubject: string | null;
  open: (overlay: Overlay) => void;
  close: (overlay: Overlay) => void;
  toggle: (overlay: Overlay) => void;
  /** Open the history overlay ON A NAMED ORDER, from anywhere. */
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
