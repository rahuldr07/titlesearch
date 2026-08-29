import type { ReactNode } from "react";

/**
 * THE TITLE ROW OF A PADDED CARD — 11px bold inside the card's own padding,
 * with an optional legend on the right of the same line.
 *
 * Not `CardHeader`, which owns a background, a border and its own padding and
 * so cannot draw this; widening it with a `bare` variant would put one screen's
 * layout choice into the kit every screen shares.
 *
 * `ink-muted`, not the design's `ink-faint`: the faint tier measures 3.17:1 at
 * 11px bold and fails AA (tokens.css:106-119) — the same deviation
 * `card-slots.tsx` already makes for the header bar. Rule 4 puts these in
 * sentence case where the design sets title case.
 */
export function CardTitle(props: {
  readonly children: ReactNode;
  readonly right?: ReactNode;
}) {
  return (
    <div className="mb-10 flex flex-wrap items-center justify-between gap-6">
      <h3 className="font-sans text-label font-bold leading-flat text-ink-muted">
        {props.children}
      </h3>
      {props.right}
    </div>
  );
}
