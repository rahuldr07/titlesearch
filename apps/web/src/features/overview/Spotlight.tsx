import { Link } from "@tanstack/react-router";
import type { Order } from "@titlepipe/contract";
import { Card, LinkButton } from "../../components/ui";
import { OrderRef } from "../../entities/order/OrderRef";

/**
 * THE ACTIVE SPOTLIGHT — design §Screens 2: "Active Spotlight card (accent left
 * border 4px, order ref 28px mono accent, Launch Workstation primary)."
 *
 * ══ WHICH ORDER IS "ACTIVE", AND WHO DECIDES ═══════════════════════════════
 *
 * The prototype's spotlight draws `activeOrderRef`, a CLIENT-HELD pointer into
 * a browsable list — you clicked a row, so that row is now active. There is no
 * such list and no such pointer here (`INVARIANTS:82-83`), so the active order
 * is the one the SERVER is serving: `GET /api/queue/next`, the only hand-over
 * (`endpoints.ts:69`).
 *
 * That makes the spotlight and the queue name the same order by construction
 * rather than by agreement — the same query, the same cache key
 * (`shared/queries.ts`), rule 11's "one variable, never two literals" applied
 * across two screens. If they ever disagreed it would mean the server had
 * changed its mind between two reads, which is the truth and worth seeing.
 *
 * ══ RULE 1 AND WHY THE ACCENT IS SPENT HERE ════════════════════════════════
 *
 * "Spend the accent once per screen: the open decision or the single primary
 * action." On the overview there is no open decision, so it goes on the one
 * action worth taking from this screen: opening the served order. The four stat
 * cards above are graphite, the recent-orders pane is graphite, and the rail's
 * own accent belongs to the rail's palette (`--color-rail-accent`), not this
 * screen's budget.
 *
 * The design's label is "Launch Workstation". The CONTRACT'S word is REVIEW
 * (`authz.ts:66`, `screen.review.enter`, path `/orders`) — ANALYSIS-screens §3
 * says to rename, and the path is not cosmetic even where the title is.
 */
export function Spotlight(props: {
  readonly order: Order | null;
  readonly pending: boolean;
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

  /*
   * NULL IS THE SERVER'S ANSWER. `QueueNextResponse.order` is nullable, and
   * nothing being served is a statement about the queue rather than a failure
   * to load one. The card stays, so the reader can tell "nothing for you" from
   * "this screen has no spotlight".
   */
  if (props.order === null) {
    return (
      <Card>
        <div className="flex flex-col gap-4">
          <span className="text-label font-bold uppercase leading-flat tracking-caps text-ink-faint">
            Active order
          </span>
          <p className="text-meta leading-body text-ink-secondary">
            The queue has nothing for this seat right now. There is no list to
            look through — work arrives by being served.
          </p>
          <Link
            to="/queue"
            className="tp-state w-fit text-meta font-semibold leading-close text-action underline-offset-4 hover:underline"
          >
            The queue
          </Link>
        </div>
      </Card>
    );
  }

  const order = props.order;

  return (
    <Card className="border-l-4 border-l-action">
      <div className="flex items-center justify-between gap-12">
        <div className="flex flex-col gap-4">
          <span className="text-label font-bold uppercase leading-flat tracking-caps text-ink-faint">
            Active order
          </span>
          <OrderRef orderRef={order.external_ref} emphasis="spotlight" />
          <span className="text-meta leading-close text-ink-secondary">
            {order.jurisdiction}
            {order.product === null
              ? " · no resolved product"
              : ` · ${order.product}`}
          </span>
        </div>
        {/*
         * A LINK, not a button that navigates. It is navigation, so it is an
         * anchor to the browser — middle-click, copy-link and the back button
         * all keep working, and INVARIANT 55's deep links stay first-class.
         */}
        <LinkButton
          variant="primary"
          href={`/orders/${order.id}`}
          data-testid="spotlight-open"
        >
          Open review
        </LinkButton>
      </div>
    </Card>
  );
}
