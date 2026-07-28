import type { ReactNode } from "react";

/**
 * The first-run panel, drawn as a DASHED outline rather than a solid card.
 *
 * The dash is doing real work: a solid card says "here is a thing", and an
 * empty product list is not a thing — it is a hole with an instruction in it.
 * The design uses the same dashed treatment on every "nothing here yet" panel
 * in the config layer, so the two read as one state rather than three screens
 * that each happen to be blank.
 *
 * It takes its actions as children because the empty states differ: products
 * offer one way in, the line catalogue offers two (seed the standard 13, or
 * write your own) and that choice is the point of the panel.
 */
export function EmptyState({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-9 border border-dashed border-line-strong bg-surface-panel p-15 text-center">
      <p className="font-semibold text-ink-primary">{title}</p>
      <p className="mt-2 text-sm leading-body text-ink-secondary">{body}</p>
      {children ? (
        <div className="mt-7 flex flex-wrap justify-center gap-4">{children}</div>
      ) : null}
    </div>
  );
}
