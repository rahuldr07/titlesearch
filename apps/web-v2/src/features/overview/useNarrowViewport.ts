import { useSyncExternalStore } from "react";

/**
 * Is the window too narrow for a seven-column board?
 *
 * A horizontally-scrolled board is worse than no board: the reader loses the
 * comparison between columns, which is the only thing the board is for. So
 * below this width the screen forces the rail — which reads better stacked
 * anyway — and SAYS SO, rather than silently ignoring a view the person chose.
 *
 * `useSyncExternalStore` over an effect-and-state pair because the match is
 * external state that can change before React commits; the store form cannot
 * tear, and it gives a server snapshot for free.
 *
 * 900px is the design's own threshold: seven columns at the drawn minimum plus
 * gaps needs roughly 1190px, and the first breakpoint below that where the rail
 * is unambiguously the better read is 900.
 */
const NARROW = "(max-width: 900px)";

let query: MediaQueryList | null = null;

function media(): MediaQueryList {
  query ??= window.matchMedia(NARROW);
  return query;
}

function subscribe(onChange: () => void): () => void {
  const list = media();
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

export function useNarrowViewport(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => media().matches,
    () => false,
  );
}
