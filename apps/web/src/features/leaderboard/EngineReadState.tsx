import type { ReactNode } from "react";
import { Alert, Card } from "../../components/ui";

/**
 * THE TWO ANSWERS A PANE ON THIS SCREEN CAN GIVE BEFORE IT HAS DATA.
 *
 * A near-copy of `features/account/PanelState.tsx`, and the duplication is
 * required rather than lazy: `check-rules.mjs`'s `cross-feature-import` rule
 * forbids `features/leaderboard` importing another feature, and `shared/` and
 * `entities/` are not this task's to edit.
 *
 * It is used PER PANE, not once for the screen, and that is INVARIANT 59: "a
 * partial failure degrades that region only". The three reads behind this
 * screen are independent — the roster is what engines declare, the leaderboard
 * is what they measured, routing is where they sit — so the seat table is still
 * readable when the leaderboard read fails, and the view switch keeps working.
 *
 * ══ THE ERROR TEXT IS THE SERVER'S ═════════════════════════════════════════
 *
 * INVARIANT 14 / 58-59. `Alert` takes a `string` so a call site cannot compose
 * one; `shared/api.ts` has already carried the server's sentence onto the
 * `Error`. This authors the FRAME — which read, and that it is unavailable
 * rather than empty — never the reason.
 */
export function EngineReadState<T>(props: {
  readonly query: {
    readonly isPending: boolean;
    readonly isError: boolean;
    readonly error: Error | null;
    readonly data: T | undefined;
  };
  /** Names the thing in the sentence — "could not load the engine roster". */
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
        <p className="text-meta leading-body text-ink-muted">Reading {props.of}…</p>
      </Card>
    );
  }

  return <>{props.children(props.query.data)}</>;
}
