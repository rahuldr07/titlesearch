import { useEffect, useState } from "react";
import type { OrderFilter } from "@titlepipe/contract";

export interface OrdersBrowseState {
  /** What is in the box now. `query` is what the server was asked to match. */
  readonly typed: string;
  readonly query: string;
  readonly filter: OrderFilter;
  readonly page: number;
  /** `clear` bumps this; it is the search box's `key`. See below. */
  readonly resetKey: number;
  readonly type: (next: string) => void;
  readonly clear: () => void;
  readonly choose: (next: OrderFilter) => void;
  readonly goToPage: (next: number) => void;
}

const SETTLE_MS = 200;

/**
 * The three browse inputs. Each of the two that change the result set
 * resets the page, because page 4 of a search matching two rows is not a
 * page. The term is debounced because `useRead` keys its cache on the
 * descriptor — a keystroke is a new key, and a new key is a pending query
 * that replaces the table. Clearing remounts the box under a new `key`.
 * The settle timer arms only when `typed` and `query` actually differ:
 * arming on every round trip would call `setPage(1)` and silently undo a
 * page chosen inside the settle window.
 */
export function useOrdersBrowse(): OrdersBrowseState {
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [page, setPage] = useState(1);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (typed === query) return;
    const settle = setTimeout(() => {
      setQuery(typed);
      setPage(1);
    }, SETTLE_MS);
    return () => {
      clearTimeout(settle);
    };
  }, [typed, query]);

  return {
    typed,
    query,
    filter,
    page,
    resetKey,
    type: setTyped,
    clear: () => {
      setTyped("");
      setResetKey((seen) => seen + 1);
    },
    choose: (next) => {
      setFilter(next);
      setPage(1);
    },
    goToPage: setPage,
  };
}
