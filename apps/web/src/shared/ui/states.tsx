import type { ReactNode } from "react";

/**
 * The non-happy-path renders, shared so no screen has to reinvent them — and so
 * none of them can accidentally render a blank.
 *
 * Orphan rule O6: every failure gets a NAMED state. A blank page, a silent
 * no-op, or an empty grid that looks like a working grid are all defects. The
 * design says it best on its own error card: it shows nothing "rather than
 * showing a blank that could be mistaken for real configuration."
 */

/** Nothing here, and that is fine — never an error treatment. */
export function EmptyState({
  title,
  detail,
  testId,
}: {
  title: string;
  detail?: string;
  testId?: string;
}) {
  return (
    <div
      {...(testId === undefined ? {} : { "data-testid": testId })}
      className="rounded-lg border border-dashed border-line-dashed bg-surface-panel px-6 py-8 text-center"
    >
      <div className="font-semibold text-ink-primary">{title}</div>
      {detail === undefined ? null : (
        <div className="mt-1 text-sm text-ink-secondary">{detail}</div>
      )}
    </div>
  );
}

/**
 * A read failed. Names the screen and shows the SERVER's message verbatim —
 * never a generic "something went wrong", which tells the user nothing and hides
 * the one detail that would help.
 */
export function Unavailable({
  what,
  detail,
  testId,
}: {
  what: string;
  detail?: string;
  testId?: string;
}) {
  return (
    <div
      {...(testId === undefined ? {} : { "data-testid": testId })}
      className="rounded-lg border border-state-halt-border bg-state-halt-surface px-5 py-4"
    >
      <div className="font-semibold text-state-halt-ink">
        {what} unavailable
      </div>
      {detail === undefined ? null : (
        <div className="mt-1 text-sm text-ink-secondary">{detail}</div>
      )}
    </div>
  );
}

/** Quiet inline loading — a route swap that resolves fast must not flash. */
export function Loading({ what }: { what: string }) {
  return (
    <div className="px-2 py-6 text-sm text-ink-muted">Loading {what}…</div>
  );
}

/**
 * A RULE element from the design that the backend does not yet own. Renders as
 * drawn but INERT, with the open question named — never guessed into working.
 * The brief: "Any RULE element ships inert: rendered but non-functional, with a
 * TODO(ruling) comment naming the open question. Or omitted. Never guessed."
 */
export function InertPending({
  what,
  ruling,
  children,
}: {
  what: string;
  /** the numbered question in docs/frontend/open-rulings.md */
  ruling: string;
  children?: ReactNode;
}) {
  return (
    <div
      data-testid="inert-pending"
      className="rounded-lg border border-dashed border-state-attend-border bg-state-attend-surface px-4 py-3"
    >
      <div className="text-micro font-bold tracking-badge text-state-attend-ink uppercase">
        Not wired — awaiting a ruling
      </div>
      <div className="mt-1 text-sm text-ink-secondary">
        <span className="font-semibold text-ink-primary">{what}</span> is drawn
        in the design but the backend does not define it yet. Blocked on{" "}
        <span className="font-mono">{ruling}</span>.
      </div>
      {children === undefined ? null : (
        <div className="mt-2 opacity-60">{children}</div>
      )}
    </div>
  );
}
