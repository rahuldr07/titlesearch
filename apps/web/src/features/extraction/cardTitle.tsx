import type { ReactNode } from "react";

/**
 * The title row of a padded card, with an optional legend on the right. Not
 * `CardHeader`, which owns a background, border, and padding — widening it
 * with a `bare` variant would put one screen's layout choice into the shared
 * kit. `ink-muted`, not `ink-faint`: the faint tier fails AA at this size.
 */
export function CardTitle(props: {
  readonly children: ReactNode;
  readonly right?: ReactNode;
}) {
  return (
    <div className="mb-10 flex flex-wrap items-center justify-between gap-6">
      <h3 className="font-sans text-label font-bold leading-flat text-ink-muted">
        {props.children}
      </h3>
      {props.right}
    </div>
  );
}
