import { OrderRail } from "./OrderRail";
import { Screen } from "../../shared/ui/Screen";
import { ScreenMessage } from "../../shared/ui/ScreenMessage";

/**
 * WHAT REVIEW DRAWS WHEN THERE IS NO WORKSTATION TO DRAW — the three states
 * where the two-pane screen cannot exist, kept together because they are one
 * decision and were three early returns competing with the screen's real body.
 *
 * `empty` IS NOT AN ERROR AND MUST NOT LOOK LIKE ONE. An order with no
 * extracted values is a normal thing — it has not reached extraction, or it has
 * nothing the report needs — and it is still an ORDER. This branch used to be a
 * bare sentence that replaced the whole screen and took the order's history with
 * it, so somebody who landed here was told what was missing and nothing about
 * what they were looking at.
 *
 * SO THE RAIL SURVIVES, and only on that branch. `OrderRail` reads the timeline,
 * which is order-scoped and answers for every order — unlike the field store,
 * whose absence is the reason we are here. `errors.spec` #3 already requires
 * this rail to survive a timeline 500 "with its identity intact"; a screen that
 * dropped it whenever the FIELD query came back empty was holding it to a
 * weaker standard than a server error.
 *
 * `loading` AND `error` DELIBERATELY DO NOT DRAW IT. On `loading` the order's
 * identity is not known yet and a rail would flash in and out; on `error` the
 * screen is reporting that it cannot speak for this order, and drawing half its
 * history underneath that would be the screen contradicting its own sentence.
 */
export interface ReviewStandinProps {
  orderId: string;
  state: "loading" | "error" | "empty";
}

export function ReviewStandin({ orderId, state }: ReviewStandinProps) {
  if (state === "error") {
    return (
      <ScreenMessage tone="halt" measure="1340">
        Order fields unavailable.
      </ScreenMessage>
    );
  }
  if (state === "loading") {
    return <ScreenMessage measure="1340">Loading the order…</ScreenMessage>;
  }
  return (
    <Screen measure="1340" pad="40">
      <ScreenMessage measure="1340">No fields on this order.</ScreenMessage>
      <OrderRail orderId={orderId} />
    </Screen>
  );
}
