import { Link } from "@tanstack/react-router";
import type { Order } from "@titlepipe/contract";
import { Card } from "../../components/ui";
import { SpotlightOrder } from "./SpotlightOrder";

/** The four answers the queue read can give. `SpotlightOrder` draws the served one. */
export function Spotlight(props: {
  readonly order: Order | null;
  readonly pending: boolean;
  readonly failed: boolean;
}) {
  if (props.pending) {
    return (
      <Card>
        <p className="text-meta leading-body text-ink-muted">
          Asking the queue what is next…
        </p>
      </Card>
    );
  }

  // A failed read is not the queue answering "nothing". Saying so would put a
  // server answer nobody sent on the screen.
  if (props.failed) {
    return (
      <Card>
        <p role="alert" className="text-meta leading-body text-state-halt">
          The queue could not be asked what is next.
        </p>
      </Card>
    );
  }

  // Null is the server's answer, not a failed load, so the card stays.
  //
  // This branch used to send the reader to /queue — a screen deleted because
  // the reference app draws none (CONFLICT-deleted-queue-and-rail-controls §1).
  // What is true now: the hand-over is still one server-chosen order (the
  // 2026-08-28 ruling NARROWED invariant 22, it did not delete it), it is
  // served HERE, and the separate browse surface the same ruling authorised is
  // All Orders.
  if (props.order === null) {
    return (
      <Card>
        <div className="flex flex-col gap-5">
          <span className="text-label font-semibold leading-flat text-ink-faint">
            Active spotlight
          </span>
          <p className="text-meta leading-body text-ink-secondary">
            The queue has nothing for this seat right now. Served work appears
            here, one order at a time — it cannot be picked by hand.
          </p>
          <Link
            to="/orders-list"
            className="tp-state w-fit text-meta font-semibold leading-close text-action underline-offset-4 hover:underline"
          >
            Browse all orders
          </Link>
        </div>
      </Card>
    );
  }

  return <SpotlightOrder order={props.order} />;
}
