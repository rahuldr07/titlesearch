import type { ReactNode } from "react";

/**
 * Restores the hover `title` on blocked composite controls. React Aria's
 * filterDOMProps allowlist passes `data-*` through but strips `title`, so a
 * reason spread onto a composite keeps `data-disabled-reason` and silently
 * loses the tooltip; native elements are unaffected.
 *
 * Renders nothing extra when the control is live. `display: contents` keeps
 * the wrapper out of layout, so the flex/grid parent still sees the control
 * as its own child. Not aria-describedby: the reason is already on the
 * field's accessible description, and a second announcement would read it
 * twice — this is the pointer affordance only, never the sole carrier.
 */
export function BlockedHint({
  reason,
  children,
}: {
  readonly reason: string | null | undefined;
  readonly children: ReactNode;
}) {
  const blocked = typeof reason === "string" && reason.length > 0;
  if (!blocked) return <>{children}</>;

  return (
    <span className="contents" title={reason}>
      {children}
    </span>
  );
}
