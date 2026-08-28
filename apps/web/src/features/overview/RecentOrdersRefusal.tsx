import { Link } from "@tanstack/react-router";
import { Card } from "../../components/ui";

/**

 * Where the prototype's recent-orders table would have been. The heading treatment is

 * the prototype's and was wrong here before: it drew "Recent orders" inside a card

 * cap, where `reference-app.html` sets it OUTSIDE the surface as a…

 */
export function RecentOrdersRefusal() {
  return (
    <section className="flex flex-col gap-8">
      <h2 className="text-body font-bold leading-tight text-ink-primary">
        Recent orders
      </h2>
      <Card>
        <div className="flex flex-col gap-5">
          <p className="max-w-260 text-meta leading-body text-ink-secondary">
            Not built, and not pending. The design draws the last ten orders here
            linking to a browsable table; no endpoint lists orders and the contract
            removed one by construction, so there is nothing to list and nowhere to
            link. The way to an order is the queue serving you one, or a deep link
            somebody sent you.
          </p>
          <p className="text-meta leading-body text-ink-secondary">
            The collision and the options for resolving it are written up in{" "}
            {/* Rule 3: a path is an identifier, which is data. */}
            <span className="font-mono text-label text-ink-muted">
              docs/frontend/design-2026-08/CONFLICT-all-orders.md
            </span>
            .
          </p>
          <Link
            to="/queue"
            className="tp-state w-fit text-meta font-semibold leading-close text-action underline-offset-4 hover:underline"
          >
            Go to the queue
          </Link>
        </div>
      </Card>
    </section>
  );
}
