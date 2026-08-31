import type { ReactNode } from "react";

/**
 * What the design draws and the contract cannot serve, said plainly: the
 * object's name, what it would bind to, and the blocking question.
 * Deliberately not a skeleton or a spinner — those say "this will arrive",
 * and the honest statement is "nothing is coming until a backend
 * conversation settles". Not an Empty either: an empty pane has nothing in
 * it, this one has nothing behind it. No Card — every site that needs this
 * already sits inside one.
 */
export function BackendGap(props: {
  /** The design's own name for the object, so the two can be matched up. */
  readonly object: string;
  /** Where the blocking question is recorded, e.g. "ANALYSIS-screens.md §7". */
  readonly conversation: string;
  readonly children: ReactNode;
}) {
  return (
    <section
      data-testid="backend-gap"
      data-gap-object={props.object}
      className="flex flex-col gap-4 rounded-md border border-dashed border-line-strong bg-surface-sunken px-8 py-6"
    >
      <div className="flex flex-wrap items-baseline gap-4">
        <span className="text-label font-semibold leading-flat text-ink-faint">
          Waiting on the backend
        </span>
        <span className="font-sans text-meta font-semibold leading-close text-ink-primary">
          {props.object}
        </span>
      </div>
      <p className="font-sans text-meta leading-body text-ink-secondary">
        {props.children}
      </p>
      <span className="font-mono text-label leading-flat text-ink-faint">
        {props.conversation}
      </span>
    </section>
  );
}
