import type { ReactNode } from "react";
import { Card } from "../../components/ui";

/**
 * THE THREE ANSWERS A READ CAN GIVE BEFORE IT HAS DATA, in one place, because
 * it was in six.
 *
 * `account/PanelState`, `dashboard/BoardState`, `complaints/ReadState`,
 * `reconciliation/ReadState`, `bench/BenchReadState` and
 * `leaderboard/EngineReadState` were the same component six times, differing in
 * their name and in whether they wrote `font-sans` (which is the default). That
 * is REVIEW-03's S2 finding — "SegmentedControl and ToggleGroup are the same
 * component, twice" — at six, and it happened because each screen was told to
 * COPY the pattern rather than told where the one copy lives.
 *
 * `features/queue/QueueStates` is deliberately NOT folded in. It answers a
 * different question — a served order, nothing served, or a broken queue — and
 * "the server has nothing for this seat" is an ANSWER rather than an absence of
 * one. Collapsing it here would flatten that distinction, which is the whole
 * subject of that screen.
 *
 * ══ WHY `entities/` AND NOT `shared/` OR A FEATURE ═════════════════════════
 *
 * `check-rules.mjs` has two rules pulling opposite ways. `cross-feature-import`
 * forbids `features/bench` reaching into `features/account` for it.
 * `presentational-fetches` forbids `shared/` and `entities/` importing
 * `@tanstack/react-query` at all — and this component never does: it takes the
 * four fields it reads as a plain object, so a caller passes a query result and
 * the component stays ignorant of what produced it. `entities/` is the layer
 * that may render domain shapes and be imported by every feature.
 *
 * ══ WHAT IT GUARANTEES ═════════════════════════════════════════════════════
 *
 * INVARIANT 58: "A failed list query renders a NAMED unavailable state." Named
 * is load-bearing — a pane that failed silently and a pane that is empty look
 * identical, and on a compliance screen that is the difference between "nobody
 * is privileged without MFA" and "we could not ask".
 *
 * INVARIANT 59 is why this is per-region rather than per-screen: "a partial
 * failure degrades that region only." A screen with three reads renders three
 * of these, and one endpoint being down leaves the other two on screen.
 *
 * INVARIANT 14: the error SENTENCE is the server's, surfaced verbatim —
 * `shared/api.ts` already puts it on the `Error`. What this component authors
 * is the FRAME (which region, and that it is unavailable rather than empty),
 * never the reason.
 *
 * `isPending`, not `isLoading`: `isLoading` is `isPending && isFetching`, so it
 * is false for a query that has never run and false during a background refetch
 * of data already on screen. `isPending` is the honest "there is no data yet",
 * which is the state this component exists to draw.
 */
export type ReadLike<T> = {
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
  readonly data: T | undefined;
};

export function QueryState<T>(props: {
  readonly query: ReadLike<T>;
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
