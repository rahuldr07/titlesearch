import type { ReactNode } from "react";
import { Card } from "../../components/ui";

/**

 * THE THREE ANSWERS A READ CAN GIVE BEFORE IT HAS DATA, in one place, because it was

 * in six. `account/PanelState`, `dashboard/BoardState`, `complaints/ReadState`,

 * `reconciliation/ReadState`, `bench/BenchReadState` and…

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
  /**
   * Overrides the failure headline where a screen's unavailable state has a
   * name of its own. `errors.spec` pins those names: the rule is that a failed
   * list renders a NAMED unavailable state, not a generic one.
   */
  readonly failedTitle?: string;
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
            {props.failedTitle ?? `Could not load ${props.of}.`}
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
        <p className="text-meta leading-body text-ink-muted">Reading {props.of}…</p>
      </Card>
    );
  }

  return <>{props.children(props.query.data)}</>;
}
