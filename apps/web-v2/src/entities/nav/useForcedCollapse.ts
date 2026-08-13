import { useEffect, useState, type RefObject } from "react";

/** Below this rail-container width the labels no longer fit and collapse is FORCED. */
const FORCE_COLLAPSE_BELOW = 900;

/**
 * IS THERE ROOM FOR THE RAIL'S LABELS? — measured, not guessed.
 *
 * MEASURED ON THE RAIL'S OWN CONTAINER, NEVER `window.innerWidth`. The
 * screenshot harness renders at a container width that differs from the
 * viewport, so container starvation has to read identically at every viewport
 * (trap §6). A media query would answer a question about the window when the
 * question is about the column.
 *
 * A FORCED COLLAPSE IS DISPLAY-ONLY. It never writes the preference, so widening
 * the window restores the user's real choice rather than leaving them folded
 * because they once resized a window. That is why this returns a second boolean
 * for `Sidebar` to OR with the persisted one, instead of calling the toggle.
 *
 * Its own hook because `Sidebar` is a presentational component that had grown an
 * effect, a ref and a piece of state — three things that are not "draw the
 * column" and that no other part of that file reads.
 */
export function useForcedCollapse(ref: RefObject<HTMLElement | null>): boolean {
  const [forced, setForced] = useState(false);

  useEffect(() => {
    const container = ref.current?.parentElement;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? Number.POSITIVE_INFINITY;
      setForced(width < FORCE_COLLAPSE_BELOW);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [ref]);

  return forced;
}
