import type { ReactNode } from "react";

/**
 * A section rubric inside the hub card. `ink-muted`, not the design's
 * `ink-faint`, which clears 4.5:1 on no surface in this palette.
 */
export function HubSectionLabel(props: { readonly children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 text-label font-bold leading-flat text-ink-muted">
      {props.children}
    </div>
  );
}
