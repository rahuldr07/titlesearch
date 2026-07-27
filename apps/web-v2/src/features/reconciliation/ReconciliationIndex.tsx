import { Link } from "@tanstack/react-router";
import { Card, CardBody } from "../../shared/ui/Card";
import { ScreenTitle } from "../../app/ScreenTitle";

/**
 * RECONCILIATION OPENS PER ORDER, and there is no picker here.
 *
 * The status screen already knows which orders are ready and how long the
 * oldest has waited; a second list here would be the same facts derived a
 * second way, free to drift. CONTRACT GAP: blind-fifty rows carry a display ref
 * (`BLIND-0644`), not the order id the reconciliation endpoint takes, so a
 * working picker cannot be built from what the server sends today.
 */
export function ReconciliationIndex() {
  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <ScreenTitle>Reconciliation</ScreenTitle>
        <p className="max-w-2xl text-base leading-body text-ink-secondary">
          Reconciliation happens one order at a time — it opens from the order,
          not from a list. The orders whose two passes are both in are on{" "}
          <Link to="/blind-status" className="font-semibold text-action underline">
            blind fifty status
          </Link>
          , with the oldest wait called out.
        </p>
        <p className="max-w-2xl text-xs leading-body text-ink-muted">
          CONTRACT GAP: the status rows carry a display reference rather than the
          order id this screen needs, so the two cannot be linked yet.
        </p>
      </CardBody>
    </Card>
  );
}
