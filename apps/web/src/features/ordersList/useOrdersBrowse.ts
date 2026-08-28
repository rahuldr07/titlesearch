import { useEffect, useState } from "react";
import type { OrderFilter } from "@titlepipe/contract";

export interface OrdersBrowseState {
  /** What is in the box right now — drives the clear affordance. */
  readonly typed: string;
  /** What the server has been asked to match. Trails `typed` by one debounce. */
  readonly query: string;
  readonly filter: OrderFilter;
  readonly page: number;
  /**
   * Bumped by `clear`. The search box is uncontrolled — `InputProps` omits both
   * `value` and `defaultValue` — so emptying it means remounting it, and this
   * is the `key` that does so. A ref would be the other way and the React
   * compiler refuses one read across a component boundary.
   */
  readonly resetKey: number;
  readonly type: (next: string) => void;
  readonly clear: () => void;
  readonly choose: (next: OrderFilter) => void;
  readonly goToPage: (next: number) => void;
}

/** Long enough that a typed word is one request, short enough to feel live. */
const SETTLE_MS = 200;

/**
 * THE THREE BROWSE INPUTS, IN ONE PLACE. Every one of them resets the page,
 * because page 4 of a search that now matches two rows is not a page.
 *
 * The debounce is here rather than in the read because `useRead` keys the cache
 * on the descriptor: a keystroke is a new key, a new key is a pending query, and
 * a pending query replaces the table. Settling the term first means one fetch
 * per word instead of one per letter.
 */
export function useOrdersBrowse(): OrdersBrowseState {
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [page, setPage] = useState(1);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    const settle = setTimeout(() => {
      setQuery(typed);
      setPage(1);
    }, SETTLE_MS);
    return () => {
      clearTimeout(settle);
    };
  }, [typed]);

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
