import type { ReactNode } from "react";
import { Card } from "../../components/ui";

/**
 * THE TWO ANSWERS THIS SCREEN CAN GIVE BEFORE IT HAS DATA. (The third —
 * "loaded and empty" — is `Empty`, and it belongs to whoever knows what an
 * empty list MEANS, which is not this component.)
 *
 * `INVARIANTS:58`: "a failed list query renders a NAMED unavailable state."
 * Named is the operative word — a region that fails silently and a region that
 * is empty look identical, and on the complaint loop that is the difference
 * between "no client has reported a defect" and "we could not ask".
 *
 * `INVARIANTS:59` is why it wraps a region rather than the screen: "a partial
 * failure degrades that region only." The rulebook read can fail while the
 * complaint list stands, and vice versa.
 *
 * ══ WHY THIS IS A SECOND COPY OF `account/PanelState` ══════════════════════
 *
 * It is nearly the same component, and that is deliberate rather than
 * overlooked. `check-rules.mjs`'s `cross-feature-import` forbids
 * `features/complaints` from importing `features/account`, and the two homes
 * that rule leaves — `shared/` and `entities/` — are outside this change's
 * writable set. Stated here rather than laundered through a barrel: the right
 * fix is ONE of these in `entities/`, and it is a separate change.
 *
 * ══ THE ERROR TEXT IS THE SERVER'S ═════════════════════════════════════════
 *
 * `INVARIANTS:14`. `shared/api.ts` already carries the server's message onto
 * the `Error`. What this component authors is the FRAME — which region, and
 * that it is unavailable rather than empty — never the reason.
 *
 * `isPending` rather than `isLoading`: `isLoading` is `isPending &&
 * isFetching`, so it is false for a query that has never run. `isPending` is
 * the honest "there is no data yet".
 */
export function ReadState<T>(props: {
  readonly query: {
    readonly isPending: boolean;
    readonly isError: boolean;
    readonly error: Error | null;
    readonly data: T | undefined;
  };
  /** Names the thing in the sentence — "could not load the complaints". */
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
