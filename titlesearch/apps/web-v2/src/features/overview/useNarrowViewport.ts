import { useSyncExternalStore } from "react";

/**
 * Is the window too narrow for a seven-column board?
 *
 * A horizontally-scrolled board is worse than no board: the reader loses the
 * comparison between columns, which is the only thing the board is for. So
 * below this width the screen forces the rail — which reads better stacked
 * anyway — and SAYS SO, rather than silently ignoring a view the person chose.
 *
 * 1190px is the export's own minimum for the seven columns at their drawn
 * width. The threshold used to be 900, which meant the 900–1190px band drew a
 * squeezed board rather than the rail: neither the export's answer (scroll) nor
 * ours (rail), and the one arrangement where the columns are too narrow to
 * compare with no affordance saying so. The board is now only ever drawn at the
 * width it was designed for.
 *
 * `useSyncExternalStore` over an effect-and-state pair because the match is
 * external state that can change before React commits; the store form cannot
 * tear, and it gives a server snapshot for free.
 */
export const NARROW_QUERY = "(max-width: 1189px)";

let query: MediaQueryList | null = null;

function media(): MediaQueryList {
  query ??= window.matchMedia(NARROW_QUERY);
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
