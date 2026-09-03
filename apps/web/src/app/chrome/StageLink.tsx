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
    /*
     * EXACT, or a stage lights up for every screen beneath it. `Link` marks
     * itself active on descendants by default, so on
     * `/orders/{id}/extraction` the hub row and the intake row both claimed
     * "you are here" alongside the real one — measured at SEVEN links
     * carrying `aria-current="page"` on the review route. A stage strip whose
     * marker means "somewhere at or under here" tells the reader nothing
     * about where they are.
     */
    activeOptions: { exact: true },
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
      /* The order travels with the step. Without it this lands on whichever
         delivered order the list happens to hold first. */
      return <Link to="/delivery" search={{ order: props.orderId }} {...shared} />;
    case "processing":
      return (
        <Link
          to="/orders/$orderId/extraction"
          params={{ orderId: props.orderId }}
          {...shared}
        />
      );
    default:
      // "upload" — the hub carries intake.
      return (
        <Link to="/orders/$orderId" params={{ orderId: props.orderId }} {...shared} />
      );
  }
}
