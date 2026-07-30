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
 * WHICH CLOSURES NEED A REASON IS THE SERVER'S CALL. Each `close_option` now
 * carries `requires_comment`, so the two that add a CLAIM — root of title, and
 * the product change with money attached — demand the sentence and the two that
 * add EVIDENCE do not. The screen used to demand one everywhere, not because
 * the rule said so but because opaque option strings gave it no way to tell the
 * dangerous ones apart; `note` is nullable for that reason and the closed card
 * omits the quote rather than printing an empty pair of quotation marks.
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
  /** Null when the server's option did not require one — never an empty string. */
  readonly note: string | null;
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
