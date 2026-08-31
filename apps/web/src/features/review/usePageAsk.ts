import { useState } from "react";
import type { PageRequest } from "./ScanViewer";

/**
 * The outstanding page ask — one state, two doors into it: the excerpt's
 * "View on page" door (`setAsk`) and the URL's `?page=`. The URL key seeds
 * the ask on mount and a changed key re-asks, so a pasted deep link and a
 * fresh click both win over "following" exactly once — then the reviewer's
 * own moves take back over. Held here rather than in `ScanPane` because the
 * decision-column door is on the other side of the split. The
 * compare-and-set-during-render is React's sanctioned "derive state from a
 * prop change" shape.
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
