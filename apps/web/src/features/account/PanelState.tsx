import type { ReactNode } from "react";
import { Card } from "../../components/ui";

/**
 * THE THREE ANSWERS A PANE CAN GIVE BEFORE IT HAS DATA, in one place so all six
 * give the same three.
 *
 * INVARIANT 58: "A failed list query renders a NAMED unavailable state." Named
 * is the operative word — a pane that fails silently and a pane that is empty
 * look identical, and on a compliance screen that is the difference between
 * "nobody is privileged without MFA" and "we could not ask".
 *
 * INVARIANT 59 is why this is per-pane rather than per-screen: "a partial
 * failure degrades that region only". The settings sidebar, the six tabs and
 * the URL keep working when one endpoint is down, because the failure is
 * rendered inside the pane that owns the read.
 *
 * ══ THE ERROR TEXT IS THE SERVER'S ═════════════════════════════════════════
 *
 * INVARIANT 14: "A refused mutation surfaces the server's message verbatim —
 * the client never authors the refusal text." This is a read rather than a
 * mutation, but the same reasoning holds and `shared/api.ts` already carries
 * the server's message onto the `Error`. What this component authors is the
 * FRAME — which pane, and that it is unavailable rather than empty — never the
 * reason.
 *
 * ══ WHY `isPending` AND NOT `isLoading` ════════════════════════════════════
 *
 * `isLoading` is `isPending && isFetching`, so it goes false on a background
 * refetch of data that is already on screen, which is correct, and it is ALSO
 * false for a query that has never run. `isPending` is the honest "there is no
 * data yet" and is the state this component exists to draw.
 */
export function PanelState<T>(props: {
  readonly query: {
    readonly isPending: boolean;
    readonly isError: boolean;
    readonly error: Error | null;
    readonly data: T | undefined;
  };
  /** Names the thing in the sentence — "could not load the roster". */
  readonly of: string;
  readonly children: (data: T) => ReactNode;
}) {
  if (props.query.isError) {
    return (
      <Card>
        <div className="flex flex-col gap-4">
          <p
            role="alert"
            className="text-meta font-semibold leading-close text-state-halt"
          >
            Could not load {props.of}.
          </p>
          {props.query.error !== null && (
            <p className="text-meta leading-body text-ink-secondary">
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
        <p className="text-meta leading-body text-ink-muted">
          Reading {props.of}…
        </p>
      </Card>
    );
  }

  return <>{props.children(props.query.data)}</>;
}
