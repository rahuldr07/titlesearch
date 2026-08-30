import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

/**
 * ⚠ RULED 2026-08-29 — `docs/frontend/design-2026-08/RULING-2026-08-29.md`:
 * the reference app's rail stage rows and order-bar stage tabs NAVIGATE, so
 * ours do. One table of destinations, used by both, so the rail row and the
 * bar tab for one stage can never disagree about where it goes.
 *
 * The stage ids are the server's (`OrderStageTab.id`); the DESTINATIONS are
 * this app's closest existing surfaces — upload and extraction land on the
 * order hub (which composes both), examination on the workstation, the
 * composer on the release compiler, and the seal on the delivery door. A
 * `switch` over literal `to` values rather than a string table, because that
 * is what keeps every destination checked against the route tree at compile
 * time.
 */
export type StageTargetId = "upload" | "processing" | "review" | "composer" | "delivered";

/** Is this stage the one the CURRENT route shows? Pathname is the only input. */
export function stageIsCurrent(id: string, pathname: string): boolean {
  if (id === "review") return /\/orders\/[^/]+\/review$/.test(pathname);
  if (id === "composer") return /\/orders\/[^/]+\/release$/.test(pathname);
  if (id === "delivered") return pathname.startsWith("/delivery");
  return false;
}

export function StageLink(props: {
  readonly id: string;
  readonly orderId: string;
  readonly className?: string | undefined;
  readonly testId?: string | undefined;
  readonly children: ReactNode;
}) {
  const shared = {
    className: props.className,
    "data-testid": props.testId,
    children: props.children,
  };
  switch (props.id) {
    case "review":
      return (
        <Link
          to="/orders/$orderId/review"
          params={{ orderId: props.orderId }}
          {...shared}
        />
      );
    case "composer":
      return (
        <Link
          to="/orders/$orderId/release"
          params={{ orderId: props.orderId }}
          {...shared}
        />
      );
    case "delivered":
      return <Link to="/delivery" {...shared} />;
    default:
      // "upload" and "processing" — the hub composes both surfaces.
      return (
        <Link to="/orders/$orderId" params={{ orderId: props.orderId }} {...shared} />
      );
  }
}
