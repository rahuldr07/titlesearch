import type { ReactNode } from "react";

/**
 * A section rubric inside the hub card: the prototype's 11px w700 label.
 *
 * The design's ink is #8a8e98 (`ink-faint`), which clears 4.5:1 on no surface in
 * this palette — `CONFLICT-ink-faint-contrast.md`. One tier up, as `CardHeader`
 * already does for the same reason.
 */
export function HubSectionLabel(props: { readonly children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 text-label font-bold leading-flat text-ink-muted">
      {props.children}
    </div>
  );
}
