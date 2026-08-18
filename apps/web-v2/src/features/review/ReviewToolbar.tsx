import { useQuery } from "@tanstack/react-query";
import { orderContextQuery } from "../../app/orderQueries";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * THE REVIEW SCREEN'S OWN THIN BAR — the package's shape, and the one action
 * that is not a per-field decision.
 *
 * IT IS NOT A SECOND ORDER HEADER, AND THAT IS THE POINT. `OrderStrip` sits
 * full-width above every order screen carrying the human ref, the four counts
 * — FIELDS · AUTO-CONFIRMED · NEED YOU · NO SOURCE — and the server's
 * lifecycle stamp. The reskin this comes from drew its own header with the
 * order id, the county, the page total and an "N to review" count, two rows
 * under a strip that already said three of those four; the count was also
 * recomputed in the browser from `fields.filter(state === "needs_review")`,
 * which is the server's judgment being re-derived beside the server's own
 * answer to it. NEED YOU is that number and the strip already prints it.
 *
 * WHAT IS LEFT IS WHAT NOTHING ELSE SAYS: how big the package is. `pages` comes
 * from `GET /api/orders/{id}/context`, the same response the strip reads, so
 * this is a second subscriber on a shared query key and not a second request.
 * It renders NOTHING while the context is in flight and nothing when `pages` is
 * `null` — an unreadable package HAS no page count, and `0 pages` would be a
 * claim where the wire deliberately sends an absence.
 *
 * CONTRACT GAP: the county. The reskin's header reads `Shelby County, TN` and
 * that string was a literal in the JSX — it would have printed Shelby over
 * every order in the system. `county` exists on `Order` and on the intake
 * schemas but not on `OrderContextResponse`, which is the only order-scoped
 * lookup a screen below `/orders/{id}` can actually reach. Until it rides
 * there, this bar names no county, because naming the wrong one out loud to a
 * client is worse than naming none.
 *
 * RAISE QUERY IS THE ESCALATION THAT ALREADY EXISTS. It opens the escalate
 * editor on the SELECTED field — the same `EscalateEditor`, the same endpoint,
 * and the same refusal: an escalation without a question is rejected. The
 * reskin drew a popover with Issue, Description, Priority and Assign-to, none
 * of which exist on the wire, and both of its buttons only closed the popover;
 * it would have taught reviewers that raising a query is a thing you do and
 * nothing happens. A query is raised ABOUT A FIELD because that is what the
 * escalation endpoint takes and what a senior reviewer needs in order to answer
 * one.
 *
 * CONTRACT GAP: priority and assignee. Both are on that popover, neither is on
 * `EscalationCreate`. An escalation is queued, not routed, in v1.
 */
export function ReviewToolbar({
  orderId,
  onRaiseQuery,
}: {
  orderId: string;
  /** Opens the escalate editor on the selected field. */
  onRaiseQuery: () => void;
}) {
  const { data: context } = useQuery(orderContextQuery(orderId));

  return (
    <div className="flex flex-none items-baseline gap-6 border-b border-line-strong bg-surface-panel px-9 py-4">
      <Eyebrow variant="caption">Review</Eyebrow>

      {context?.pages == null ? null : (
        <span className="font-mono text-tiny text-ink-muted">
          {context.pages} pages
        </span>
      )}

      <span className="flex-1" />

      {/*
        A QUIET BUTTON, NOT THE SEALING WAX. The accent is spent once per screen
        on the one action, and on this screen that action is the decision card's
        CONFIRM. A filled "Raise query" up here would compete with it, on a
        screen where the wrong one of those two being easiest to press is how a
        value gets escalated instead of read.
      */}
      <button
        type="button"
        data-testid="act-raise-query"
        onClick={onRaiseQuery}
        className="rounded-5 border border-line-strong px-4 py-2 text-sm font-semibold text-ink-secondary"
      >
        Raise query
      </button>
    </div>
  );
}
