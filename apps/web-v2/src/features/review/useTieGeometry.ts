import { useCallback, useEffect, useState } from "react";

/** The two endpoints, in viewport coordinates. `null` while either is absent. */
export interface Tie {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * WHERE THE TIE'S TWO ENDS ARE, kept current without polling.
 *
 * The reskin this replaces ran `getBoundingClientRect` on both ends every 200ms
 * for the life of the screen, on a screen meant to be sat in front of for an
 * hour. Positions change only when something MOVES, so this listens for the
 * things that move them — captured passive scroll (either column scrolls
 * independently), viewport resize, and `ResizeObserver` on the endpoints — and
 * does nothing in between.
 *
 * READS ARE COALESCED INTO ONE FRAME. Scroll outpaces paint and
 * `getBoundingClientRect` forces layout, so an unthrottled handler turns a
 * flick of the wheel into hundreds of synchronous reflows.
 *
 * `null` IS RETURNED RATHER THAN A GUESS at every failure: a missing element, or
 * one with a zero-area rect because it is not laid out. Drawing to the origin of
 * an unlaid-out element puts a line in the window's corner pointing at nothing.
 */
export function useTieGeometry(fromId: string, toId: string): Tie | null {
  const [tie, setTie] = useState<Tie | null>(null);

  const measure = useCallback((): boolean => {
    const from = document.getElementById(fromId);
    const to = document.getElementById(toId);
    // A zero-area rect is an element not laid out — drawing to its origin would
    // put the line in the window's corner, pointing at nothing.
    if (from === null || to === null) {
      setTie(null);
      return false;
    }
    const a = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    if (a.width === 0 || b.width === 0) {
      setTie(null);
      return false;
    }
    setTie({
      x1: a.right,
      y1: a.top + a.height / 2,
      x2: b.left,
      y2: b.top + b.height / 2,
    });
    return true;
  }, [fromId, toId]);

  useEffect(() => {
    let frame = 0;
    const sizes = new ResizeObserver(() => schedule());
    /*
     * BOTH ENDPOINTS ARRIVE LATE, and that is the whole reason this observer
     * exists. The highlight is rendered from `GET /api/orders/{id}/pages`, so on
     * first paint there is no element to point at — and none of the events above
     * fire when React later commits one. Measuring once on mount drew nothing,
     * forever, which is precisely the hole the 200ms poll it replaces was
     * filling by brute force.
     *
     * IT IS ARMED ONLY WHILE AN ENDPOINT IS MISSING. A subtree observer over the
     * whole body is expensive to leave running; this one disconnects the moment
     * both ends resolve and re-arms if one disappears, so it costs something
     * only during the load it exists for.
     */
    const appearances = new MutationObserver(() => schedule());

    function schedule() {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const found = measure();
        sizes.disconnect();
        if (found) {
          appearances.disconnect();
          const from = document.getElementById(fromId);
          const to = document.getElementById(toId);
          if (from !== null) sizes.observe(from);
          if (to !== null) sizes.observe(to);
        } else {
          appearances.observe(document.body, { childList: true, subtree: true });
        }
      });
    }

    schedule();
    // `true` — capture, so scrolling ANY ancestor scroller counts, not just the
    // window. Both columns scroll independently and either moves an endpoint.
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      sizes.disconnect();
      appearances.disconnect();
    };
  }, [measure, fromId, toId]);


  return tie;
}
