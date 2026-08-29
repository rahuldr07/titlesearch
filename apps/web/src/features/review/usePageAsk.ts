import { useState } from "react";
import type { PageRequest } from "./ScanViewer";

/**
 * THE OUTSTANDING PAGE ASK — one state, two doors into it.
 *
 * A `PageRequest` is a reader asking for a page OUTRIGHT, which `ScanViewer`
 * already ranks above the "following" mode (an ask is not a citation). Two
 * things ask:
 *
 *   - the excerpt's "View on page" door in the decision column (`setAsk`);
 *   - the URL's `?page=` — the extraction matrix's "open the workstation AT
 *     this page" (design §Screens 6, INVARIANT 55: selection is URL-owned).
 *
 * The URL key SEEDS the ask on mount and a CHANGED key re-asks, so a pasted
 * deep link and a fresh matrix click both win over "following" exactly once —
 * then the reviewer's own moves take back over, which is the least-surprising
 * reading of both mechanisms. Held here rather than in `ScanPane` because the
 * decision-column door is on the other side of the split.
 *
 * The compare-and-set-during-render is React's sanctioned "derive state from a
 * prop change" shape, the same one `ScanViewer` uses for `citedAt`/`askedAt`.
 */
export function usePageAsk(urlPage: number | undefined) {
  const [ask, setAsk] = useState<PageRequest | null>(
    urlPage === undefined ? null : { page: urlPage },
  );
  const [seen, setSeen] = useState(urlPage);
  if (seen !== urlPage) {
    setSeen(urlPage);
    if (urlPage !== undefined) setAsk({ page: urlPage });
  }
  return { ask, setAsk };
}
