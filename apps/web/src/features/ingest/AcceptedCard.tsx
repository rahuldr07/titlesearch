import { Link } from "@tanstack/react-router";
import type { Order } from "@titlepipe/contract";
import { Badge, Button } from "../../components/ui";

/** The record after the second act. The order is queued because the server said so. */
export function AcceptedCard(props: {
  readonly order: Order;
  readonly onAgain: () => void;
}) {
  return (
    <div
      data-testid="accepted-card"
      className="flex flex-col gap-6 rounded-lg border border-line-strong bg-surface-panel p-12 shadow-card"
    >
      {/* Rule 6: a coloured capsule at a moment of record, and this is one. */}
      <Badge tone="settled">✓ Signed for</Badge>

      <p className="font-sans text-subject font-semibold leading-tight text-ink-primary">
        Signed for. Order{" "}
        <span className="font-mono">{props.order.external_ref}</span> is queued.
      </p>

      <p className="font-sans text-meta leading-body text-ink-secondary">
        {props.order.county} Co., {props.order.state} — accepted and headed for
        the pipeline. The queue decides who sees it next; there is no way to
        pick it out of the queue by hand.
      </p>

      <div className="flex flex-wrap items-center gap-8">
        {/* /queue was deleted (CONFLICT-deleted-queue-and-rail-controls §1);
            the browse table is where an accepted order can be seen. */}
        <Link
          to="/orders-list"
          className="font-sans text-meta font-semibold leading-close text-action underline underline-offset-4"
        >
          See it in all orders →
        </Link>
        <Button data-testid="ingest-again" onPress={props.onAgain}>
          Ingest another
        </Button>
      </div>
    </div>
  );
}
