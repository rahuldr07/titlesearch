import type { ReactNode } from "react";
import type { ChipTone } from "./Chip";

/**
 * The panel every list row, gap card and detail block is built from.
 *
 * `edge` paints a 4px left border in a state colour — design-mock's standard way
 * of marking a card that needs attention (held orders, completeness gaps,
 * escalated fields). Omit it for a neutral card; do not fake it with a border
 * colour on the whole card, which reads as an error state.
 */
export function Card({
  edge,
  testId,
  children,
}: {
  edge?: ChipTone;
  testId?: string;
  children: ReactNode;
}) {
  const EDGE: Record<ChipTone, string> = {
    settled: "border-l-4 border-l-state-settled",
    decide: "border-l-4 border-l-state-decide",
    attend: "border-l-4 border-l-state-attend",
    halt: "border-l-4 border-l-state-halt",
    neutral: "border-l-4 border-l-line-strong",
    quiet: "",
  };
  return (
    <div
      {...(testId === undefined ? {} : { "data-testid": testId })}
      className={`rounded-lg border border-line-strong bg-surface-panel ${edge === undefined ? "" : EDGE[edge]}`}
    >
      {children}
    </div>
  );
}

/** Muted sub-header inside a Card — the `#fbfbfc` band design-mock uses. */
export function CardHeader({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-line-subtle bg-surface-sunken px-4 py-2.5 text-micro font-bold tracking-badge text-ink-primary uppercase">
      {children}
    </div>
  );
}

export function CardBody({ children }: { children: ReactNode }) {
  return <div className="px-4 py-3">{children}</div>;
}
