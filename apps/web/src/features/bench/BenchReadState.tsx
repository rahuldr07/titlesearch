import type { ReactNode } from "react";
import { Alert, Card } from "../../components/ui";

/**
 * THE TWO ANSWERS THIS SCREEN CAN GIVE BEFORE IT HAS DATA.
 *
 * A near-copy of `features/account/PanelState.tsx`, and the duplication is
 * REQUIRED rather than lazy: `check-rules.mjs`'s `cross-feature-import` rule
 * forbids `features/bench` importing `features/account`, and the shared homes
 * — `shared/` and `entities/` — are not this task's to edit. The alternative
 * was a screen that renders a blank pane while it waits, which INVARIANT 58
 * names as the defect: "a failed list query renders a NAMED unavailable state."
 * Named is the operative word — a pane that failed and a bench run with no
 * failures look identical when both are blank, and on this screen that is the
 * difference between "nothing is wrong" and "we could not ask".
 *
 * ══ THE ERROR TEXT IS THE SERVER'S ═════════════════════════════════════════
 *
 * INVARIANT 14 / 58-59. `Alert` takes a `string` precisely so a call site
 * cannot compose one, and `shared/api.ts` has already carried the server's
 * sentence onto the `Error`. What this component authors is the FRAME — which
 * read, and that it is unavailable rather than empty — never the reason.
 *
 * `isPending` rather than `isLoading`: `isLoading` is false for a query that
 * has never run, which is exactly the state this exists to draw.
 */
export function BenchReadState<T>(props: {
  readonly query: {
    readonly isPending: boolean;
    readonly isError: boolean;
    readonly error: Error | null;
    readonly data: T | undefined;
  };
  /** Names the thing in the sentence — "could not load the bench run". */
  readonly of: string;
  readonly children: (data: T) => ReactNode;
}) {
  if (props.query.isError) {
    return (
      <Alert
        tone="halt"
        title={`Could not load ${props.of}.`}
        message={props.query.error?.message ?? ""}
      />
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
