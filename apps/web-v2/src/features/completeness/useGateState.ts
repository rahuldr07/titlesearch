import { useState } from "react";

/**
 * How each gap was closed on this screen, and by whom.
 *
 * A CLOSURE KEEPS ITS OPTION AND ITS REASON, never collapsing to "resolved".
 * The ways out of a gap are not equivalent — a document arriving is evidence,
 * an amended answer is a change to a signed assertion, a root of title is a
 * fresh claim, a product change moves money — and a single "closed" flag would
 * erase exactly the distinction the order's history is supposed to carry.
 *
 * EVERY CLOSURE NEEDS A REASON, without exception. The wire offers the options
 * as plain strings and says nothing about which of them are consequential, so
 * the screen cannot single out the dangerous ones; requiring the sentence
 * everywhere is the only version of that rule this schema can support, and a
 * gap closed with no stated reason is unreadable six months later anyway.
 *
 * CONTRACT GAP: nothing accepts any of this. `GET /api/orders/:id/completeness`
 * is a read; there is no closure write, no supplemental upload, no sign-off
 * amendment, no root-of-title assertion and no product change. Closures live in
 * this component tree only and vanish on reload. In the product every one of
 * them is an append-only server record — none is a UI state.
 */
export interface GapClosure {
  /** One of the server's own `close_options` strings, chosen verbatim. */
  readonly option: string;
  readonly note: string;
  readonly by: string;
}

export function useGateState() {
  const [closures, setClosures] = useState<Record<string, GapClosure>>({});

  return {
    closures,
    close: (gapId: string, closure: GapClosure) =>
      setClosures((prev) => ({ ...prev, [gapId]: closure })),
  };
}
