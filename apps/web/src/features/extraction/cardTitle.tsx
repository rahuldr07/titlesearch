import type { ReactNode } from "react";

/**
 * THE TITLE ROW OF A PADDED CARD.
 *
 * The design gives this screen two card shapes, not one. The policy-exceptions
 * card has the kit's `CardHeader` — a sunken bar with a rule under it. The
 * stages and matrix cards do NOT: their title is 11px bold sitting inside the
 * card's own 24px padding, with an optional legend on the right of the same
 * line. `CardHeader` cannot draw that (it owns a background, a border and its
 * own padding), and widening it with a `bare` variant would put a screen's
 * layout choice into the kit every screen shares.
 *
 * `ink-muted`, not the design's `ink-faint`: the faint tier measures 3.17:1 at
 * 11px bold and fails AA (tokens.css:106-119, and the same deviation
 * `card-slots.tsx` already makes for the header bar).
 *
 * Rule 4: sentence case. The design sets these in title case; the gate would
 * not catch it, but the register would be wrong beside every other card.
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
