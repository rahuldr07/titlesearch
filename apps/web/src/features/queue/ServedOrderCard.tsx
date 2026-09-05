import type { Order } from "@titlepipe/contract";
import { Button, Card, Kbd } from "../../components/ui";
import { ServedOrder } from "./ServedOrder";
import { PassReason } from "./PassReason";

/**
 * THE SERVED ORDER AND THE TWO ACTS ON IT — the card, and the foot of the card
 * that switches between the two acts and the reason field.
 *
 * Split out of `QueueScreen` at §6's 150-line cap. The screen keeps the
 * queries, the mutation and the chord layer; this keeps the markup, which is
 * the division the rule is asking for ("a component is missing").
 *
 * ══ TWO ACTS, AND NEITHER OF THEM IS "PICK ANOTHER" ════════════════════════
 *
 * Start review, or pass with a reason. That is the whole of what a reviewer may
 * do with a served order, and the absence of a third control is
 * `INVARIANTS:82-83` rendered: there is no skip, no defer, no "show me a
 * different one", and no row to click instead. A pass is not a skip — it is
 * recorded, it carries a reason the next person inherits, and the fourth one
 * auto-escalates server-side.
 *
 * ══ RULE 1: THE ACCENT IS SPENT ONCE, ON START REVIEW ══════════════════════
 *
 * Pass is a ghost button. That asymmetry is the product's opinion in visual
 * form — the expected act is to do the work — and it is also why Pass is not
 * `secondary`: two bordered buttons side by side read as a choice between
 * equals, which this is not.
 *
 * ══ WHY THE REASON REPLACES THE BUTTONS RATHER THAN APPEARING BELOW ════════
 *
 * While the reason is open, Start review must not be one Enter away: Enter
 * belongs to the reason field (`focusOwnership.ts` — a focused control owns the
 * keystroke), and a primary button still on screen beside it invites a click
 * that would abandon a half-typed reason without saying so.
 */
export function ServedOrderCard(props: {
  readonly order: Order;
  readonly passing: boolean;
  readonly passPending: boolean;
  readonly onStartReview: () => void;
  readonly onOpenPass: () => void;
  readonly onSubmitPass: (reason: string) => void;
  readonly onCancelPass: () => void;
}) {
  return (
    <Card padding="none">
      <ServedOrder order={props.order} />
      <div className="flex flex-col gap-6 border-t border-line-subtle px-12 py-10">
        {props.passing ? (
          <PassReason
            pending={props.passPending}
            onSubmit={props.onSubmitPass}
            onCancel={props.onCancelPass}
          />
        ) : (
          <div className="flex items-center gap-6">
            <Button variant="primary" onPress={props.onStartReview}>
              Start review <Kbd muted>Enter</Kbd>
            </Button>
            <Button variant="ghost" onPress={props.onOpenPass}>
              Pass <Kbd muted>P</Kbd>
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
