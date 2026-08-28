import type { ReactNode } from "react";
import { Card } from "../../components/ui";

/**
 * THE THREE ANSWERS THE BOARD CAN GIVE BEFORE IT HAS DATA.
 *
 * `features/account/PanelState.tsx` is the same object for the settings panes
 * and is deliberately NOT imported: `check-rules.mjs`'s `cross-feature-import`
 * forbids `features/dashboard` reaching into `features/account`, and the rule
 * is right here rather than merely satisfied — the account version frames its
 * failure as one pane of six degrading alone (INVARIANT 59), and this one
 * frames the whole screen's subject being unavailable. The two sentences are
 * not the same sentence.
 *
 * INVARIANT 58: "A failed list query renders a NAMED unavailable state."
 * Named is the operative word. A board that fails silently and a shop with no
 * work in it draw the same seven empty columns, and on a screen whose entire
 * job is "where is everything", that is the difference between "nothing is
 * outstanding" and "we could not ask".
 *
 * ══ THE ERROR TEXT IS THE SERVER'S ═════════════════════════════════════════
 *
 * INVARIANT 14 is written for a refused mutation — "the client never authors
 * the refusal text" — and the same reasoning holds for a read. `shared/api.ts`
 * already carries the server's message onto the `Error`. What this component
 * authors is the FRAME: which screen, and that it is unavailable rather than
 * empty. Never the reason.
 *
 * ══ WHY `isPending` AND NOT `isLoading` ════════════════════════════════════
 *
 * `isLoading` is `isPending && isFetching`, so it goes false on a background
 * refetch of a board that is already on screen — correct — and it is ALSO
 * false for a query that has never run. `isPending` is the honest "there is no
 * data yet", which is the state this component exists to draw.
 */
export function BoardState<T>(props: {
  readonly query: {
    readonly isPending: boolean;
    readonly isError: boolean;
    readonly error: Error | null;
    readonly data: T | undefined;
  };
  /** Names the thing in the sentence — "could not load the lifecycle board". */
  readonly of: string;
  readonly children: (data: T) => ReactNode;
}) {
  if (props.query.isError) {
    return (
      <Card>
        <div className="flex flex-col gap-4">
          <p
            role="alert"
            className="font-sans text-meta leading-close font-semibold text-state-halt"
          >
            Could not load {props.of}.
          </p>
          {props.query.error !== null && (
            <p className="font-sans text-meta leading-body text-ink-secondary">
              {props.query.error.message}
            </p>
          )}
        </div>
      </Card>
    );
  }

  if (props.query.isPending || props.query.data === undefined) {
    return (
      <Card>
        <p className="font-sans text-meta leading-body text-ink-muted">
          Reading {props.of}…
        </p>
      </Card>
    );
  }

  return <>{props.children(props.query.data)}</>;
}
