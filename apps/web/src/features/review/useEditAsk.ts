import { useRef, useState } from "react";
import { useReviewWrites } from "./useReviewWrites";

export type EditAsk = { readonly path: string; readonly n: number };

/** The inline editor's surface on the field queue, as one spread. */
export type InlineEditProps = {
  readonly editingPath: string | null;
  readonly pending: boolean;
  readonly onCancelInline: () => void;
  readonly onSaveInline: (field: { readonly id: string }, value: string) => void;
};

/**
 * The inline-edit ask: which row's editor is open, and a counter so raising
 * the same path twice remounts the editor rather than being swallowed as an
 * identical state.
 *
 * Opening is DOUBLE-CLICK. `FieldQueue` wires `onDoubleClick` on the row
 * wrapper and `FieldRow` on the row itself, and `clicked()` catches the case
 * the native event cannot.
 *
 * `clicked()` was removed once, correctly: it kept the last clicked path in a
 * ref with NO TIME WINDOW and nothing reset it, so clicking a row, moving away
 * with J/K, and later clicking that row again to reselect it opened a write
 * surface by a gesture nobody meant as one.
 *
 * It is back with a window, because the native event genuinely cannot cover
 * every row. Selecting a row scrolls it to the top of the pane — measured at
 * 1781px → −43px for `mortgages.1.lender` — so the second click of a
 * double-click lands nowhere near the row it started on, and the browser
 * never raises `dblclick`. Rows that happen not to move worked; rows further
 * down the queue silently did not.
 *
 * The window is what answers the original objection: a click 400ms stale is
 * not half of anything, so keyboard navigation between two clicks can no
 * longer join them into an open.
 */
export function useEditAsk(orderId: string) {
  const writes = useReviewWrites(orderId);
  const [ask, setAsk] = useState<EditAsk | null>(null);
  const raise = (path: string) => {
    setAsk((prev) => ({ path, n: (prev?.n ?? 0) + 1 }));
  };
  const clear = () => {
    setAsk(null);
    last.current = null;
  };
  /* `performance.now()` rather than `Date.now()`: this is elapsed time
     between two gestures, not a moment of record, and `check-rules`'
     raw-date rule is right to keep clock reads out of the app. */
  const last = useRef<{ path: string; at: number } | null>(null);
  const DOUBLE_CLICK_MS = 400;
  const clicked = (path: string) => {
    const now = performance.now();
    const prev = last.current;
    last.current = { path, at: now };
    if (prev !== null && prev.path === path && now - prev.at <= DOUBLE_CLICK_MS) {
      last.current = null;
      raise(path);
    }
  };
  return {
    ask,
    raise,
    clear,
    clicked,
    /* The inline editor's whole surface for FieldQueue, as one spread. The
       screen was carrying four one-line props for a concern it does not
       own. */
    queueProps: {
      editingPath: ask?.path ?? null,
      pending: writes.pending,
      onCancelInline: clear,
      onSaveInline: (f: { readonly id: string }, value: string) => {
        writes.correct(f.id, { value }, clear);
      },
    } satisfies InlineEditProps,
    pending: writes.pending,
    save: (fieldId: string, value: string) => {
      writes.correct(fieldId, { value }, clear);
    },
  };
}
