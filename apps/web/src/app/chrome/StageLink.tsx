import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

/**
 * One table of stage destinations, used by both the rail stage rows and the
 * order-bar stage tabs, so the two can never disagree about where a stage
 * goes. The stage ids are the server's; the destinations are this app's
 * closest existing surfaces. A `switch` over literal `to` values rather
 * than a string table keeps every destination checked against the route
 * tree at compile time. `stageIsCurrent` (its own module, for fast refresh)
 * answers the other half: whether a stage's door is the one on screen.
 */
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
